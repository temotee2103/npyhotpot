# Phase 3 Design (Members → Admin → Ops → Retry UX)

## Goals

- Make member signup/login/profile flows consistent and reliable (no silent profile provisioning failures).
- Align all admin pages to the canonical order/payment statuses introduced in Phase 2.
- Tighten remaining sensitive Edge Function CORS without breaking cron/admin flows.
- Add a safe “Retry Payment” UX using Phase 2 payment attempts (same order, new payment attempt).

## Non-Goals

- Invoice/PDF/email/refunds (Phase 4).
- Rewriting the entire admin UI framework.

## A) Members / Auth

### A1. Profile provisioning reliability

Problem:
- Email/password sign-up may not have a session (email confirmation on), so frontend `official_profiles.upsert(...)` can fail under RLS.

Design:
- Ensure profile provisioning happens when a real session exists:
  - After successful login, call the existing Edge Function `ensure-official-profile` (service-role) to create `official_profiles` row if missing.
  - Keep OAuth callback behavior (already ensures profile).
  - Remove/soften direct profile upsert attempts on the register page (or keep but treat as best-effort, never relied upon).

Acceptance:
- New email/password signup + email confirmation enabled still results in a usable profile after first login.

### A2. Unique phone/email constraints

Problem:
- Phone-login uses `maybeSingle()` lookup by phone; duplicates break login.

Design:
- Add DB uniqueness constraints:
  - `official_profiles.phone` unique when not null/blank (partial unique index).
  - `official_profiles.email` unique when not null/blank (partial unique index).

Acceptance:
- Duplicate phone/email cannot be created in `official_profiles`.

### A3. Password policy consistency

Problem:
- Strong password enforced on `/register`, but other auth UIs use “min 6 chars”.

Design:
- Update `AuthCard` and `AuthGateModal` to validate with the same strong password rule used in register (`isStrongPassword`), and update user-facing message.

Acceptance:
- All entry points enforce the same password policy.

### A4. Profile email sync

Problem:
- Updating `official_profiles.email` without updating Supabase Auth creates identity drift.

Design:
- When user updates email in member profile:
  - call `supabase.auth.updateUser({ email })` and handle verification requirements if enabled
  - only update `official_profiles.email` after auth update succeeds (or store a “pending_email” field if needed)

Acceptance:
- Supabase Auth email and `official_profiles.email` remain consistent.

### A5. Merchant profile update policy alignment

Problem:
- RLS restricts `official_profiles` self-update to role=customer in one migration, which can block merchant UX.

Design:
- Decide intended merchant behavior and adjust RLS accordingly:
  - Allow merchants to update a safe subset of fields on their own profile (full_name, phone, etc.), or
  - Route merchants to a separate merchant profile table/page.

Acceptance:
- Merchant can edit allowed fields without RLS errors.

## B) Admin UI Alignment (Phase 2 canonical statuses)

Canonical statuses:
- Orders: `created, paid, fulfilling, completed, cancelled, payment_failed`
- Payments: `created, pending, succeeded, failed, superseded`

Design:
- Update remaining admin pages that still use legacy buckets (`pending/processing/failed/...`).
- Where payment status is shown, prefer the order’s active payment attempt (`official_orders.active_payment_id`) and fall back to latest payment only when null.

Acceptance:
- Admin dashboards, filters, and counts match canonical statuses and show correct payment state with retries.

## C) Ops Hardening

Design:
- Replace wildcard CORS with the allowlist helper on sensitive functions:
  - `payex-webhook`
  - `ops-self-heal`
- Extend shared CORS helper to optionally include extra allowed headers (e.g. `x-cron-secret`) while keeping origin allowlist.

Acceptance:
- Browser origins are restricted.
- Cron/admin calls still work (cron secret header is accepted).

## D) Payment Retry UX

Design:
- Add “Retry Payment” entry points:
  - Member order pages (shop + delivery) when order status is `created` or `payment_failed`
  - Optional admin order detail action for support
- Action:
  - Call `payex-create-intent` again with same `orderId` and redirect to returned `paymentUrl`
  - Phase 2 ensures a new payment attempt is created and old attempts are superseded

Acceptance:
- Retry creates a new payment attempt row and redirects user to Payex.
- Order remains the same id; active payment attempt changes.

