# Phase 1 Security Fixes Design (Checkout + Payment)

## Goals

- Prevent delivery order undercharging by removing trust in client-provided unit price, title, and shipping fee.
- Prevent unauthorized reading of order/payment/delivery status by enforcing order ownership (or admin role).
- Prevent payment redirect abuse by allowlisting return URL origins.
- Prevent spoofed Payex callbacks by failing closed when webhook signature secrets are missing.
- Replace wildcard CORS with an origin allowlist for browser calls.

## Non-Goals

- Full invoice/receipt/PDF/refund implementation.
- Full order/payment status state machine redesign.

## Constraints

- Frontend is statically exported Next.js; all server logic must be implemented in Supabase DB and Edge Functions.
- Edge Functions use Supabase service role keys for database access; authorization must be implemented explicitly in the function handler.

## Configuration

- `EDGE_ALLOWED_ORIGINS`: comma-separated list of allowed browser origins for CORS (prod + staging + localhost).
- `PAYEX_RETURN_URL_ALLOWED_ORIGINS`: comma-separated list of allowed origins for Payex return URLs (prod + staging + localhost).
- `PAYEX_SIGNATURE_SECRET`: required; webhook signature verification fails closed if missing.

## Data Model Changes

### New Table: `public.official_delivery_quotes`

Purpose: store the delivery quotation returned by Lalamove so checkout can verify shipping fee and prevent client tampering.

Fields (minimum):

- `quotation_id text primary key`
- `user_id uuid references public.official_profiles(id)`
- `service_type text not null`
- `currency text not null`
- `fee numeric(10,2) not null`
- `distance_meters integer`
- `price_breakdown jsonb not null default '{}'::jsonb`
- `expires_at timestamptz`
- `created_at timestamptz not null default now()`

Indexes:

- `index official_delivery_quotes_user_id_created_at (user_id, created_at desc)`

## Edge Function Changes

### CORS Allowlist Helper (applies to all touched functions)

- If request includes `Origin` and it is in `EDGE_ALLOWED_ORIGINS`, respond with that origin.
- Otherwise, do not allow browser access (no wildcard).
- Always include `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type` and `Access-Control-Allow-Methods: POST, OPTIONS`.

### `delivery-quote`

- After obtaining the quote, upsert `official_delivery_quotes`:
  - `quotation_id`, `user_id` (from Authorization bearer token), `service_type`, `currency`, `fee`, `expires_at`, `distance_meters`, `price_breakdown`.
- If user is not authenticated, allow quote response but store `user_id = null`.

### `checkout-delivery`

Checkout action:

- Require authentication (order owner only).
- Require `quotationId` and verify:
  - quote exists
  - quote belongs to user
  - quote not expired
  - currency matches
  - shipping fee equals stored quote fee
- Re-price items server-side:
  - Request payload includes `itemId`, `quantity`, and selected option IDs grouped by `groupId`.
  - Load `official_menu_items.base_price` and option deltas from `official_menu_option_options` for the selected option IDs.
  - Validate selected options belong to the item via `official_menu_item_option_groups`.
  - Compute unit price and subtotal using DB values only.
- Persist `official_order_items.title` from `official_menu_items.name` plus option names.

Status and payment_status actions:

- Require authentication.
- Fetch order by id and verify `order.user_id === auth.user.id` or user is admin.
- Only then return delivery/payment status.

### `payex-payment-status`

- Require authentication.
- Fetch order by id and verify `order.user_id === auth.user.id` or user is admin before returning anything.

### `payex-create-intent`

- Validate `returnUrl`:
  - If provided, its `origin` must be in `PAYEX_RETURN_URL_ALLOWED_ORIGINS`.
  - If not allowlisted, reject with 400 and require callers to use the configured default return URLs.

### `payex` shared verification

- `verifyPayexSignature` fails closed if `PAYEX_SIGNATURE_SECRET` is missing.

## Frontend Changes

### Delivery Checkout Payload

- Include `quotationId` in the `checkout-delivery` payload.
- Include selected options in cartItems payload (option ids per group) so the backend can re-price:
  - Do not send `unitPrice` as an authoritative value (backend ignores it).

## Testing / Validation

- Attempt to submit a delivery checkout request with `unitPrice=0.01` via devtools; order total charged must still match DB pricing.
- Attempt to call status endpoints without being logged in; must return 401.
- Attempt to call status endpoints while logged in as a different user; must return 403.
- Attempt to call `payex-create-intent` with `returnUrl=https://evil.com/...`; must return 400.
- With missing `PAYEX_SIGNATURE_SECRET`, Payex webhook must return non-200.

