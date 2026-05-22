# Phase 3 (Members + Admin + Ops + Retry UX) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix member auth/profile consistency, align admin pages to Phase 2 canonical statuses, tighten remaining CORS for sensitive Edge Functions, and add “Retry Payment” UX using payment attempts.

**Architecture:** Use the existing `ensure-official-profile` Edge Function to provision profiles on login, enforce phone/email uniqueness at DB level, unify password rules across auth entry points, align admin queries/filters to canonical statuses and active payment, tighten CORS via allowlist helper (with extra header support), and add retry-payment buttons that call `payex-create-intent` again.

**Tech Stack:** Next.js + Supabase JS (frontend), Supabase Postgres migrations, Supabase Edge Functions (Deno).

---

## Files / Components Map

**Create**
- `supabase/migrations/20260517100000_official_profiles_unique_phone_email.sql`

**Modify**
- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/components/auth-card.tsx`
- `src/components/auth-gate-modal.tsx`
- `src/app/member/profile/page.tsx`
- `src/app/admin/shop/orders/page.tsx` (already partly updated; confirm)
- `src/app/admin/transactions/page.tsx`
- `src/app/admin/platform/system-health/page.tsx`
- `supabase/functions/_shared/cors.ts`
- `supabase/functions/ops-self-heal/index.ts`
- `supabase/functions/payex-webhook/index.ts`
- `src/app/member/orders/shop/page.tsx`
- `src/app/member/orders/delivery/page.tsx`

---

### Task 1: Enforce unique phone/email in `official_profiles`

**Files:**
- Create: `supabase/migrations/20260517100000_official_profiles_unique_phone_email.sql`

- [ ] **Step 1: Create partial unique indexes**

```sql
create unique index if not exists uq_official_profiles_phone
on public.official_profiles (phone)
where phone is not null and length(trim(phone)) > 0;

create unique index if not exists uq_official_profiles_email
on public.official_profiles (email)
where email is not null and length(trim(email)) > 0;
```

---

### Task 2: Ensure profile provisioning on email/password login

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: After successful signInWithPassword, invoke ensure profile**

Add after successful `signInWithPassword` (before `routeAfterLogin()`):

```ts
await supabase.functions.invoke("ensure-official-profile", {
  body: {
    full_name: null,
    phone: null,
    email: email,
  },
});
```

- [ ] **Step 2: If ensure profile fails, still continue**

Do not block login; only surface a non-fatal message if needed.

---

### Task 3: Registration provisioning adjustments

**Files:**
- Modify: `src/app/register/page.tsx`

- [ ] **Step 1: Treat `official_profiles.upsert` as best-effort**

Keep the upsert call if you want, but:
- check the response error
- show a message if it fails (profile will be created on first login anyway)

- [ ] **Step 2: Reduce reliance on profile insert for phone-login**

Ensure login flow can still provision profile on first login.

---

### Task 4: Unify password policy across auth entry points

**Files:**
- Modify: `src/components/auth-card.tsx`
- Modify: `src/components/auth-gate-modal.tsx`

- [ ] **Step 1: Use `isStrongPassword`**

Update disabled state and submit validation:

```ts
import { isStrongPassword } from "@/lib/validators/password";
```

Replace `password.length < 6` checks with `!isStrongPassword(password)`.
Update placeholder and message text to match register page requirement.

---

### Task 5: Profile email sync with Supabase Auth

**Files:**
- Modify: `src/app/member/profile/page.tsx`

- [ ] **Step 1: When saving email changes, call `supabase.auth.updateUser`**

Implementation:
- detect if email is changed
- call `await supabase.auth.updateUser({ email: newEmail })`
- if it succeeds, then update `official_profiles.email`
- if it fails, show error and do not update profile email

---

### Task 6: Admin pages align to canonical statuses + active payment

**Files:**
- Modify: `src/app/admin/transactions/page.tsx`
- Modify: `src/app/admin/platform/system-health/page.tsx`

- [ ] **Step 1: Replace order status buckets**

Replace legacy buckets:
- pending → created
- processing → fulfilling
- failed → payment_failed

- [ ] **Step 2: Prefer active payment attempt**

Where payment status is shown, fetch payment by:
- `official_orders.active_payment_id` if present
- else fallback to latest payment by created_at

---

### Task 7: Tighten CORS for sensitive Edge Functions

**Files:**
- Modify: `supabase/functions/_shared/cors.ts`
- Modify: `supabase/functions/ops-self-heal/index.ts`
- Modify: `supabase/functions/payex-webhook/index.ts`

- [ ] **Step 1: Extend shared CORS helper to accept extra headers**

Change signature:

```ts
export function buildCorsHeaders(request: Request, extraHeaders: string[] = [])
```

And merge headers as comma-separated list.

- [ ] **Step 2: Apply allowlist CORS to ops-self-heal**

Use `buildCorsHeaders(request, ["x-cron-secret"])`.

- [ ] **Step 3: Apply allowlist CORS to payex-webhook**

Use `buildCorsHeaders(request)` and block disallowed origins.

---

### Task 8: Retry payment UX (member)

**Files:**
- Modify: `src/app/member/orders/shop/page.tsx`
- Modify: `src/app/member/orders/delivery/page.tsx`

- [ ] **Step 1: Add “Retry Payment” button**

Visibility:
- order.status in `created` or `payment_failed`

Action:
- call `createPayexIntent({ officialOrderId: order.id, channel: order.channel, returnUrl: `${window.location.origin}/payment/result` })`
- redirect to returned `paymentUrl`

---

### Task 9: Verification checklist

- [ ] **Step 1: DB indexes**
  - Attempt to create duplicate phone/email profiles should fail.

- [ ] **Step 2: Login provisioning**
  - Email signup with email confirmation: after verifying email + first login, profile exists.

- [ ] **Step 3: Password rules**
  - Auth modal/card now rejects weak password same as register page.

- [ ] **Step 4: Retry payment**
  - Clicking retry creates a new payment attempt (old superseded) and redirects correctly.

