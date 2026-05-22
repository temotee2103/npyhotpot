# Phase 2 Reliability + Idempotency Design (Orders / Payments / Delivery)

## Goals

- Enforce a single canonical order status model across backend and admin UI.
- Support payment retries on the same order via multiple payment attempts.
- Make payment/order status transitions monotonic (no downgrade from terminal/progressed states).
- Make side effects idempotent (award points, redeem coupons, create delivery dispatch) so webhook/reconcile retries cannot duplicate work.
- Make checkout atomic (DB transaction) for both shop and delivery channels.
- Reduce long-lived inconsistent states and make ops repair safe and repeatable.

## Non-Goals

- Invoice numbering/PDF/email/refunds (Phase 4).
- Reworking membership rules (beyond making points posting idempotent per order).

## Canonical Status Model

### `official_orders.status` (canonical)

Use only:

- `created`
- `paid`
- `fulfilling`
- `completed`
- `cancelled`
- `payment_failed`

Rules:

- Order can only move forward (created → paid → fulfilling → completed).
- `payment_failed` only allowed from `created`.
- `cancelled` allowed from `created` or `paid` (depending on business policy; default allow both).
- Once `completed` or `cancelled`, never change again.

### `official_payments.status` (attempt-level)

Use only:

- `created`
- `pending`
- `succeeded`
- `failed`
- `superseded`

Rules:

- `superseded` marks old attempts when a new attempt is created for the same order.
- Once `succeeded`/`failed`/`superseded`, never change again.

## Payment Attempts (Retry on Same Order)

### Data Model

Add:

- `official_orders.active_payment_id uuid references public.official_payments(id)`

Behavior:

- Each retry creates a new `official_payments` row.
- `active_payment_id` points to the latest attempt.
- Webhook/reconcile updates are applied to the active attempt, or the attempt that matches the gateway reference (preferred).

## Monotonic Transitions

### Order transitions driven by payment

- `pending` should never downgrade an order already `paid/fulfilling/completed/cancelled`.
- `failed` should not downgrade an order already `paid/fulfilling/completed` (late failure).
- If the order is `cancelled`, ignore payment updates.

### Payment attempt transitions

- `pending` should not overwrite `succeeded/failed/superseded`.

## Idempotent Side Effects (“Settle Once”)

### Settlement Marker

Add:

- `official_orders.paid_at timestamptz`
- `official_orders.settled_at timestamptz`

Settlement rules:

- When payment becomes `succeeded`, set `paid_at` if null.
- Run side effects only if `settled_at is null`, then set `settled_at`.

Side effects included:

- Points posting (`official_post_points_for_consumption`), keyed by `source_type='order_paid'` and `source_id=order_id` so duplicates are rejected or treated as no-op.
- Referral binding RPC (`official_bind_referral_from_user_metadata`) should be safe to re-run.
- Coupon redemption marking for the order coupon ids.
- Delivery dispatch creation from `official_payment_contexts` when channel=delivery and context not processed.

## Delivery Dispatch Uniqueness

Add DB constraint:

- `unique(order_id)` on `official_deliveries`

Behavior:

- Delivery creation uses insert-with-unique; if conflict occurs, treat as already exists.
- Removes race conditions between webhook and reconcile/ops-self-heal.

## Atomic Checkout (DB Transaction / RPC)

Create DB RPC functions:

- `official_checkout_shop(p_user_id, p_currency, p_items, p_shipping, p_coupon_codes, p_shipping_fee, p_client_idempotency_key?)`
- `official_checkout_delivery(p_user_id, p_currency, p_items, p_shipping, p_coupon_codes, p_quotation_id)`

Responsibilities (in one DB transaction):

- Validate payload (non-empty items, allowed currency/channel).
- Compute pricing server-side (variants/bundles for shop; menu + option deltas for delivery).
- Validate delivery quote (`official_delivery_quotes`) ownership + expiry + currency; derive shipping fee.
- Apply coupons and reserve coupons for order (or fail with conflict).
- Insert `official_orders` and `official_order_items`.
- Create first payment attempt row in `official_payments` with status `created` or `pending` (depending on flow).
- Set `official_orders.active_payment_id` to that payment attempt.

Edge Functions become thin wrappers around these RPC calls.

## Payex Integration Alignment

### Intent creation

- On each Payex intent creation, insert a new payment attempt row and set it as active.
- Mark previous non-terminal attempts as `superseded`.

### Webhook & reconcile

- Locate payment attempt by `gateway_ref` (payment intent key or txn id), otherwise fall back to active_payment_id.
- Call a single state-application function that enforces monotonic transitions and settlement guards.

## Ops Repair (“Self Heal”) Alignment

Update repair logic to be safe under idempotency:

- If order is `paid` but `settled_at` is null, re-run settlement (safe).
- If delivery context exists and deliveries row missing, attempt delivery dispatch (safe due to unique constraint).
- Continue releasing stale coupon reservations for orders not paid after retention window.

## Rollout Plan / Migration Safety

- Add new columns/constraints first (non-breaking).
- Add code that writes both old/new fields where needed.
- After verifying stability, enforce stricter constraints (e.g., status enums) and update admin UI to match canonical statuses.

## Acceptance Criteria

- Payment retry creates a new payment attempt under the same order; old attempt becomes `superseded`.
- Webhook duplicates do not create extra points, extra coupon redeems, or duplicate deliveries.
- Reconcile calls cannot downgrade a paid order to created.
- Checkout cannot leave partial orders/items/coupon reservations.

