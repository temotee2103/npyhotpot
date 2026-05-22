# Phase 2 (Reliability + Idempotency) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make orders/payments/delivery processing reliable under retries, webhook duplicates, and concurrency by enforcing canonical statuses, introducing payment attempts, monotonic transitions, idempotent settlement, delivery uniqueness, and atomic checkout (shop + delivery).

**Architecture:** Add DB constraints and columns for payment attempts and settlement markers, update Payex state application to be monotonic and settlement-guarded, add unique constraint for deliveries, and move checkout into transactional Postgres RPC functions that Edge Functions call.

**Tech Stack:** Supabase Postgres migrations (SQL + PL/pgSQL), Supabase Edge Functions (Deno + supabase-js), Next.js admin UI mapping updates.

---

## Files / Components Map

**Create**
- `supabase/migrations/20260515120000_official_phase2_statuses_and_attempts.sql`
- `supabase/migrations/20260515121000_official_deliveries_unique_order_id.sql`
- `supabase/migrations/20260515122000_official_checkout_rpc_shop.sql`
- `supabase/migrations/20260515123000_official_checkout_rpc_delivery.sql`

**Modify**
- `supabase/functions/_shared/payex-order.ts`
- `supabase/functions/payex-create-intent/index.ts`
- `supabase/functions/checkout-shop/index.ts` (switch to RPC + CORS helper)
- `supabase/functions/checkout-delivery/index.ts` (switch to RPC)
- `src/lib/admin/official-orders.ts` and/or admin pages that hardcode status labels (align UI counts to canonical)
- `supabase/functions/ops-self-heal/index.ts` (re-run settlement safely; delivery retry safe)

---

### Task 1: Add Phase 2 columns + constraints (statuses, payment attempts, settlement markers)

**Files:**
- Create: `supabase/migrations/20260515120000_official_phase2_statuses_and_attempts.sql`

- [ ] **Step 1: Add canonical status constraints**

```sql
alter table public.official_orders
  add column if not exists paid_at timestamptz,
  add column if not exists settled_at timestamptz,
  add column if not exists active_payment_id uuid;

alter table public.official_orders
  add constraint if not exists official_orders_status_check_v2
  check (status in ('created','paid','fulfilling','completed','cancelled','payment_failed'));

alter table public.official_payments
  add column if not exists method text,
  add column if not exists provider text,
  add column if not exists txn_id text,
  add column if not exists is_active boolean not null default false;

alter table public.official_payments
  add constraint if not exists official_payments_status_check_v2
  check (status in ('created','pending','succeeded','failed','superseded'));
```

- [ ] **Step 2: Link active_payment_id to payments**

```sql
alter table public.official_orders
  add constraint if not exists official_orders_active_payment_fk
  foreign key (active_payment_id) references public.official_payments(id);
```

- [ ] **Step 3: Backfill existing data**

```sql
update public.official_orders
set status = 'created'
where status not in ('created','paid','fulfilling','completed','cancelled','payment_failed');

update public.official_payments
set status = 'pending'
where status in ('created') and gateway_ref like 'PENDING-%';

update public.official_payments
set status = 'pending'
where status not in ('created','pending','succeeded','failed','superseded');
```

- [ ] **Step 4: Mark latest payment attempt active per order**

```sql
with latest as (
  select distinct on (order_id) id, order_id
  from public.official_payments
  order by order_id, created_at desc
)
update public.official_payments p
set is_active = true
from latest
where p.id = latest.id;

update public.official_orders o
set active_payment_id = latest.id
from latest
where o.id = latest.order_id
  and (o.active_payment_id is null);
```

---

### Task 2: Add delivery uniqueness constraint (race-safe dispatch)

**Files:**
- Create: `supabase/migrations/20260515121000_official_deliveries_unique_order_id.sql`

- [ ] **Step 1: Add unique(order_id)**

```sql
create unique index if not exists official_deliveries_order_id_unique
  on public.official_deliveries (order_id);
```

---

### Task 3: Implement monotonic payment + order transitions and settlement guard

**Files:**
- Modify: `supabase/functions/_shared/payex-order.ts`

- [ ] **Step 1: Implement monotonic transition helpers**

Add these functions near `mapOrderStatus`:

```ts
function isTerminalOrderStatus(status: string) {
  return ["completed", "cancelled"].includes(status);
}

function isPaidOrBeyond(status: string) {
  return ["paid", "fulfilling", "completed"].includes(status);
}

function nextOrderStatus(current: string, paymentStatus: "succeeded" | "pending" | "failed") {
  if (isTerminalOrderStatus(current)) return current;
  if (current === "cancelled") return current;
  if (paymentStatus === "succeeded") return isPaidOrBeyond(current) ? current : "paid";
  if (paymentStatus === "failed") return isPaidOrBeyond(current) ? current : "payment_failed";
  return current || "created";
}

function nextPaymentStatus(current: string, incoming: "succeeded" | "pending" | "failed") {
  if (["succeeded", "failed", "superseded"].includes(current)) return current;
  if (incoming === "succeeded") return "succeeded";
  if (incoming === "failed") return "failed";
  return "pending";
}
```

- [ ] **Step 2: Update `applyPayexOrderState` to update only the active payment attempt**

Read current order + active payment:

```ts
const orderRow = await supabase
  .from("official_orders")
  .select("id,status,user_id,channel,total,outlet_id,active_payment_id,paid_at,settled_at,user_coupon_id,user_coupon_ids")
  .eq("id", args.orderId)
  .maybeSingle();
```

Update payment:
- Target payment by `active_payment_id` if present; otherwise latest by created_at.
- Use `nextPaymentStatus` based on current status and incoming.
- Set `txn_id` separately from `gateway_ref` (store both).

Update order:
- Use `nextOrderStatus(orderRow.status, args.paymentStatus)` and update only if changed.
- If succeeded and `paid_at is null`, set `paid_at = now()`.

- [ ] **Step 3: Settlement guard**

Only if `args.paymentStatus === "succeeded"`:
- If `settled_at` is already set, skip side effects and return ok.
- Otherwise:
  - Run referral binding RPC
  - Run points RPC
  - Mark coupons redeemed
  - Run delivery dispatch from payment_context if needed
  - Set `settled_at = now()` at the end

Implementation note:
- Do an update `set settled_at = now()` with a filter `where settled_at is null` and verify it actually took effect (so only one concurrent worker "wins").

---

### Task 4: Payment attempts on Payex intent creation

**Files:**
- Modify: `supabase/functions/payex-create-intent/index.ts`

- [ ] **Step 1: Insert a new payment attempt row**

After Payex intent is created (you have `paymentIntentKey`):
- Insert a new `official_payments` row with:
  - `order_id`, `gateway_ref = paymentIntentKey`, `status='pending'`, `provider='Payex'`, `method='redirect'`, `is_active=true`
- Update old attempts: `set is_active=false, status='superseded'` for same order where `is_active=true` and `id != newId` and status in (`created`,`pending`)
- Update `official_orders.active_payment_id` to new payment id

- [ ] **Step 2: Stop updating payments via `.eq('order_id', ...)`**

Replace the existing update-by-order_id statement with the above insert + supersede flow.

---

### Task 5: Atomic checkout RPC for shop

**Files:**
- Create: `supabase/migrations/20260515122000_official_checkout_rpc_shop.sql`
- Modify: `supabase/functions/checkout-shop/index.ts`

- [ ] **Step 1: Create RPC**

Create function `public.official_checkout_shop(...) returns jsonb` (security definer, search_path public) that:
- validates inputs
- computes subtotal server-side
- applies coupons and reserves
- inserts order + items
- creates first payment attempt (`official_payments`) and sets `active_payment_id`
- returns `{ order_id, payment_id }` JSON

- [ ] **Step 2: Update Edge Function to call RPC**

In `checkout-shop/index.ts`:
- Replace multi-step inserts with `supabase.rpc("official_checkout_shop", {...})`.
- Keep response format for frontend.
- Update CORS to use `_shared/cors.ts` (align with Phase 1 standard).

---

### Task 6: Atomic checkout RPC for delivery

**Files:**
- Create: `supabase/migrations/20260515123000_official_checkout_rpc_delivery.sql`
- Modify: `supabase/functions/checkout-delivery/index.ts`

- [ ] **Step 1: Create RPC**

Create function `public.official_checkout_delivery(...) returns jsonb` that:
- validates inputs
- validates quotationId ownership/expiry/currency and uses stored fee
- reprices items + options server-side
- applies coupons + reserves
- inserts order + items
- creates first payment attempt and sets `active_payment_id`
- returns `{ order_id, payment_id, outlet_id }`

- [ ] **Step 2: Update Edge Function checkout action to call RPC**

Keep `status` and `payment_status` actions as currently implemented (owner/admin gate stays).

---

### Task 7: Update admin UI status mapping

**Files:**
- Modify: `src/lib/admin/official-orders.ts` and any admin pages that hardcode status buckets

- [ ] **Step 1: Align filters and counters to canonical statuses**

Search and update occurrences where admin counts `pending/processing/completed` etc, and map them to the canonical set:
- created
- paid
- fulfilling
- completed
- cancelled
- payment_failed

---

### Task 8: Ops self-heal alignment

**Files:**
- Modify: `supabase/functions/ops-self-heal/index.ts`

- [ ] **Step 1: Re-run settlement safely**

If order is paid but not settled, call the same settlement pathway (now idempotent).

- [ ] **Step 2: Delivery retry safe**

If delivery should exist, attempt dispatch; unique(order_id) makes it safe.

---

### Task 9: Verification checklist

- [ ] **Step 1: Payment retry behavior**
  - Create intent twice for same order → two payment rows, only newest is active, older is superseded.

- [ ] **Step 2: Webhook duplicate**
  - Simulate calling webhook twice with same succeeded status → points/coupons/delivery dispatch occur only once.

- [ ] **Step 3: No downgrade**
  - If order already paid, reconcile result pending → order remains paid.

- [ ] **Step 4: Checkout atomicity**
  - Force an error mid-checkout (e.g., invalid coupon) → no partial order/items/coupon reservations remain.

