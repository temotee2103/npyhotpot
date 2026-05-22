# Phase 1 (Checkout + Payment Security) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the most critical security gaps in delivery checkout + payment flows (price tampering, IDOR on status endpoints, returnUrl abuse, webhook verification fail-open, and wildcard CORS).

**Architecture:** Add a delivery quote persistence table, enforce auth + ownership checks in Edge Functions using the bearer token, re-price delivery cart server-side from DB, and standardize CORS and returnUrl validation via allowlists.

**Tech Stack:** Supabase Edge Functions (Deno + supabase-js), Supabase Postgres migrations, Next.js (React) frontend.

---

## Files / Components Map

**Create**
- `supabase/functions/_shared/cors.ts` (origin allowlist helpers)
- `supabase/migrations/20260515100000_official_delivery_quotes.sql` (delivery quote persistence table)
- `docs/superpowers/plans/2026-05-15-phase1-security-fixes.md` (this plan)

**Modify**
- `supabase/functions/delivery-quote/index.ts` (store quote; use allowlist CORS)
- `supabase/functions/checkout-delivery/index.ts` (authz for status endpoints; quote verification; server-side re-pricing; allowlist CORS)
- `supabase/functions/payex-payment-status/index.ts` (authz; allowlist CORS)
- `supabase/functions/payex-create-intent/index.ts` (returnUrl allowlist; allowlist CORS)
- `supabase/functions/_shared/payex.ts` (fail-closed signature verification)
- `src/app/delivery/checkout/page.tsx` (send quotationId + option selections in checkout payload)

---

### Task 1: Add shared CORS allowlist helper for Edge Functions

**Files:**
- Create: `supabase/functions/_shared/cors.ts`

- [ ] **Step 1: Create `_shared/cors.ts`**

```ts
export const DEFAULT_ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type";

function parseAllowedOrigins(raw: string | null | undefined) {
  return (raw ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function buildCorsHeaders(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  const allowlist = parseAllowedOrigins(Deno.env.get("EDGE_ALLOWED_ORIGINS"));
  const allowOrigin = origin && allowlist.includes(origin) ? origin : "";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

export function isCorsAllowed(request: Request) {
  const origin = request.headers.get("origin") ?? "";
  if (!origin) return true;
  const allowlist = parseAllowedOrigins(Deno.env.get("EDGE_ALLOWED_ORIGINS"));
  return allowlist.includes(origin);
}
```

- [ ] **Step 2: Usage standard**

For all touched functions:
- On `OPTIONS`, return `200` with `buildCorsHeaders(request)`.
- If `!isCorsAllowed(request)`, return `403` (browser-origin blocked) with JSON.
- Include `{ "Content-Type": "application/json", ...buildCorsHeaders(request) }` on responses.

---

### Task 2: Add delivery quote persistence table

**Files:**
- Create: `supabase/migrations/20260515100000_official_delivery_quotes.sql`

- [ ] **Step 1: Add migration**

```sql
create table if not exists public.official_delivery_quotes (
  quotation_id text primary key,
  user_id uuid references public.official_profiles(id) on delete set null,
  service_type text not null,
  currency text not null,
  fee numeric(10,2) not null default 0,
  distance_meters integer,
  price_breakdown jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists official_delivery_quotes_user_created_idx
  on public.official_delivery_quotes (user_id, created_at desc);
```

---

### Task 3: Store quote in `delivery-quote` Edge Function

**Files:**
- Modify: `supabase/functions/delivery-quote/index.ts`

- [ ] **Step 1: Replace wildcard CORS with allowlist helper**

Update imports and remove `corsHeaders` constant:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { callLalamove, getLalamoveMockMode } from "../_shared/lalamove.ts";
import { buildCorsHeaders, isCorsAllowed } from "../_shared/cors.ts";
```

- [ ] **Step 2: Add Supabase admin client helper**

```ts
function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}
```

- [ ] **Step 3: Parse quote fields and upsert into `official_delivery_quotes`**

Insert this helper near the top:

```ts
function extractQuoteFields(raw: unknown) {
  const data = raw && typeof raw === "object" ? (raw as { data?: unknown }).data : null;
  const quotationId = typeof (data as { quotationId?: unknown } | null)?.quotationId === "string" ? (data as { quotationId: string }).quotationId : "";
  const serviceType = typeof (data as { serviceType?: unknown } | null)?.serviceType === "string" ? (data as { serviceType: string }).serviceType : "";
  const expiresAt = typeof (data as { expiresAt?: unknown } | null)?.expiresAt === "string" ? (data as { expiresAt: string }).expiresAt : null;
  const distanceValue = Number((data as { distance?: { value?: unknown } } | null)?.distance?.value ?? 0);
  const distanceMeters = Number.isFinite(distanceValue) ? Math.round(distanceValue) : null;
  const breakdown = (data as { priceBreakdown?: unknown } | null)?.priceBreakdown;
  const breakdownObj = breakdown && typeof breakdown === "object" ? (breakdown as Record<string, unknown>) : {};
  const currency = typeof breakdownObj.currency === "string" ? breakdownObj.currency : "";
  const totalText = typeof breakdownObj.total === "string" ? breakdownObj.total : "";
  const fee = Number(totalText || 0);
  return {
    quotationId,
    serviceType,
    currency,
    fee: Number.isFinite(fee) ? Number(fee.toFixed(2)) : 0,
    distanceMeters,
    priceBreakdown: breakdownObj,
    expiresAt,
  };
}
```

Then inside the handler:
- Use `const corsHeaders = buildCorsHeaders(request);`
- If `!isCorsAllowed(request)`, return 403.
- Extract user id from bearer token (if present) using `supabase.auth.getUser(token)`.
- After obtaining quote response `result.data` (or mock), call `extractQuoteFields` and upsert.

Upsert snippet:

```ts
const quote = extractQuoteFields(result.data);
if (supabase && quote.quotationId && quote.serviceType && quote.currency) {
  await supabase.from("official_delivery_quotes").upsert({
    quotation_id: quote.quotationId,
    user_id: userId,
    service_type: quote.serviceType,
    currency: quote.currency,
    fee: quote.fee,
    distance_meters: quote.distanceMeters,
    price_breakdown: quote.priceBreakdown,
    expires_at: quote.expiresAt,
  });
}
```

---

### Task 4: Lock down and harden `checkout-delivery`

**Files:**
- Modify: `supabase/functions/checkout-delivery/index.ts`
- Modify: `src/app/delivery/checkout/page.tsx`

- [ ] **Step 1: Replace wildcard CORS + block disallowed origins**

At top, import:

```ts
import { buildCorsHeaders, isCorsAllowed } from "../_shared/cors.ts";
```

Replace all uses of `corsHeaders` with:

```ts
const corsHeaders = buildCorsHeaders(request);
if (!isCorsAllowed(request)) {
  return new Response(JSON.stringify({ message: "Origin not allowed" }), {
    status: 403,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}
```

- [ ] **Step 2: Require auth for `status` and `payment_status` actions**

Before reading delivery/payment/order:
- If `!userId`, return `401`.
- Fetch `official_orders.user_id` and verify:
  - `order.user_id === userId` OR user is admin.

Admin check (service role context):

```ts
async function isAdmin(supabase: ReturnType<typeof createClient>, userId: string) {
  const profile = await supabase.from("official_profiles").select("role,status").eq("id", userId).maybeSingle();
  const role = String(profile.data?.role ?? "");
  const status = String(profile.data?.status ?? "active");
  return status === "active" && (role === "admin" || role === "super_admin");
}
```

Ownership check:

```ts
async function assertOrderReadable(args: { supabase: ReturnType<typeof createClient>; orderId: string; userId: string }) {
  const order = await args.supabase.from("official_orders").select("id,user_id").eq("id", args.orderId).maybeSingle();
  if (order.error || !order.data?.id) return { ok: false as const, status: 404, message: "Order not found" };
  if (order.data.user_id === args.userId) return { ok: true as const };
  if (await isAdmin(args.supabase, args.userId)) return { ok: true as const };
  return { ok: false as const, status: 403, message: "Forbidden" };
}
```

- [ ] **Step 3: Require `quotationId` and verify quote for checkout**

Extend request payload type:

```ts
type CheckoutPayload = {
  action?: "checkout" | "status" | "payment_status";
  quotationId?: string;
  ...
};
```

For checkout:
- if `!userId`, return 401
- if `!body.quotationId`, return 400
- load quote:

```ts
const quote = await supabase
  .from("official_delivery_quotes")
  .select("quotation_id,user_id,fee,currency,expires_at")
  .eq("quotation_id", body.quotationId)
  .maybeSingle();
```

Validate:
- exists
- `quote.user_id === userId`
- `quote.expires_at` is not in the past
- `quote.currency === body.currency`

Use `shippingFee = Number(quote.fee)` and ignore `body.totals.shipping_fee`.

- [ ] **Step 4: Re-price delivery cart server-side**

Extend cart item type:

```ts
type CheckoutCartItem = {
  id: string;
  quantity: number;
  selectedOptions?: Array<{ groupId: string; optionId: string }>;
};
```

Server-side pricing algorithm:
- Load menu items:

```ts
const itemIds = [...new Set(cartItems.map((x) => x.id))];
const items = await supabase
  .from("official_menu_items")
  .select("id,name,base_price,is_active")
  .in("id", itemIds);
```

- Load allowed group mapping for those items:

```ts
const itemGroupRows = await supabase
  .from("official_menu_item_option_groups")
  .select("item_id,group_id")
  .in("item_id", itemIds);
```

- Load selected options:

```ts
const selectedOptionIds = [
  ...new Set(
    cartItems.flatMap((x) => (x.selectedOptions ?? []).map((o) => o.optionId).filter(Boolean)),
  ),
];
const optionRows = selectedOptionIds.length
  ? await supabase
      .from("official_menu_option_options")
      .select("id,group_id,name,price_delta")
      .in("id", selectedOptionIds)
  : { data: [], error: null };
```

- Validate each selected option:
  - option exists
  - option.group_id matches the provided `groupId`
  - groupId is linked to itemId by `official_menu_item_option_groups`

- Compute per-line unit price:
  - `unit = base_price + sum(price_delta)`
  - `lineTotal = unit * quantity`

- Persist into `official_order_items`:
  - `unit_price` is computed unit
  - `title` is `menuItem.name` plus option names joined as ` (a / b)`

- [ ] **Step 5: Update frontend delivery checkout payload**

In [delivery checkout](file:///d:/wampserver/www/npyhotpot/src/app/delivery/checkout/page.tsx#L589-L614):
- Add `quotationId: parsedQuote.quotationId`
- Send selected options:

```ts
const payloadCartItems = cartItems.map(({ line }) => ({
  id: line.itemId,
  quantity: line.quantity,
  selectedOptions: line.selectedOptions.map((opt) => ({ groupId: opt.groupId, optionId: opt.optionId })),
}));
```

Keep `title/unitPrice` out of the payload (or keep only temporarily), because backend uses DB values.

---

### Task 5: Lock down `payex-payment-status`

**Files:**
- Modify: `supabase/functions/payex-payment-status/index.ts`

- [ ] **Step 1: Add allowlist CORS using `_shared/cors.ts`**

- [ ] **Step 2: Require auth + ownership before returning anything**

Add token parsing (same approach as `checkout-delivery`):
- If no userId → 401.
- Read order `user_id` and verify owner or admin; else 403.
- Then proceed with reconciliation + return payload.

---

### Task 6: Return URL allowlist in `payex-create-intent`

**Files:**
- Modify: `supabase/functions/payex-create-intent/index.ts`

- [ ] **Step 1: Add allowlist CORS using `_shared/cors.ts`**

- [ ] **Step 2: Validate `returnUrl` origin**

Add helper:

```ts
function parseAllowedOrigins(raw: string | null | undefined) {
  return (raw ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function isAllowedReturnUrl(urlText: string) {
  try {
    const url = new URL(urlText);
    const allowlist = parseAllowedOrigins(Deno.env.get("PAYEX_RETURN_URL_ALLOWED_ORIGINS"));
    return allowlist.includes(url.origin);
  } catch {
    return false;
  }
}
```

Enforcement:
- If `body.returnUrl` is provided and `!isAllowedReturnUrl(body.returnUrl)`, return `400` with message.
- Otherwise keep existing `getPayexUrls(body.channel, body.returnUrl)` logic.

---

### Task 7: Fail-closed Payex signature verification

**Files:**
- Modify: `supabase/functions/_shared/payex.ts`

- [ ] **Step 1: Update `verifyPayexSignature`**

Replace:

```ts
if (!config?.signatureSecret) return { ok: true as const };
```

With:

```ts
if (!config?.signatureSecret) return { ok: false as const, message: "Payex signature secret not configured" };
```

---

### Task 8: Verification (manual + code checks)

**Files:**
- Review: modified files above

- [ ] **Step 1: Smoke-check TypeScript compile for frontend**

Run:
- `npm run build`

Expected:
- Build succeeds (no TS errors in modified frontend files).

- [ ] **Step 2: Delivery checkout tampering test**

Manual steps:
- Log in as a test user.
- Add delivery items and options.
- Before checkout request, modify the payload in devtools (set unitPrice to 0.01 or remove options).
Expected:
- Server still prices correctly from DB, and order totals match DB pricing, not client values.

- [ ] **Step 3: Quote tampering test**

Manual steps:
- Call checkout with a different `quotationId` from another user.
Expected:
- 403/400 (quote owner mismatch).

- [ ] **Step 4: Status endpoint auth tests**

Manual steps:
- Call `checkout-delivery` `action:"status"` without auth.
Expected:
- 401.

Manual steps:
- Call as another logged-in user with a known `orderId`.
Expected:
- 403.

- [ ] **Step 5: Return URL allowlist test**

Manual steps:
- Invoke `payex-create-intent` with `returnUrl=https://example.com/payment/result`.
Expected:
- 400 (blocked).

- [ ] **Step 6: Webhook fail-closed**

Manual steps:
- Temporarily unset `PAYEX_SIGNATURE_SECRET` in the Edge Function environment.
- Trigger Payex webhook call (or simulate).
Expected:
- Webhook verification fails and does not apply order state.

