# 2026-04-29 Admin And Order History Fixes Design

## Goal

Fix four confirmed logic issues without broad refactoring:

1. Editing users in admin pages must not silently reactivate disabled accounts.
2. `AdminAuthGate` must stop creating dirty `official_profiles` rows when profile lookup fails.
3. Admin-created customer accounts must receive the same rewards initialization guarantees as self-registered customers.
4. Order-history cleanup SQL must actually remove order-derived history while preserving users, products, coupons, and points unrelated to orders.

## Scope

In scope:

- `src/app/admin/users/customers/page.tsx`
- `src/app/admin/users/admins/page.tsx`
- `src/app/admin/users/merchants/page.tsx`
- `src/components/admin-auth-gate.tsx`
- `supabase/functions/admin-user-create/index.ts`
- `supabase/sql/clear-order-history-keep-users-and-products.sql`

Out of scope:

- Broad admin user management refactors
- Reworking rewards domain design
- Rewriting coupon or points ledger architecture

## Design

### 1. Preserve Existing Status During Admin Edits

Current edit flows hardcode `status: "active"` during save. The fix is to carry the current row status into edit state when opening the modal, then submit that preserved status back through `updateOfficialProfileDetail()`.

This keeps disabled accounts disabled unless the explicit enable/disable action is used.

### 2. Make `AdminAuthGate` Fail Closed Without Writing Data

Current logic treats `!profile` before checking `error`, which can write a partial `official_profiles` row during transient read failures. The fix is:

- Check `error` first and return forbidden.
- If there is no error and no profile, treat it as forbidden without writing.

No auto-upsert should happen inside the gate.

### 3. Initialize Rewards for Admin-Created Customers

Self-registration already guarantees rewards setup through `member-rewards-card`. Admin-created customers should receive the same initialization behavior. After `official_profiles` upsert succeeds in `admin-user-create`, invoke the same rewards setup path for `customer` role before returning success.

If rewards initialization fails, rollback the created auth user/profile to avoid half-created customer accounts.

### 4. Make Order Cleanup SQL Match Its Intent

The current SQL only deletes `official_orders`, relying on FK cascades. That leaves order-derived records such as points ledger entries with `source_type = 'order_paid'` and potentially coupon reservation/redeem traces that are business history derived from deleted orders.

The cleanup SQL should:

- delete order-derived points ledger rows where `source_type = 'order_paid'`
- null coupon order references explicitly if needed before order deletion
- delete orders so dependent order tables cascade naturally

The script must continue preserving:

- `auth.users`
- `official_profiles`
- menu/shop product data
- coupon templates and user coupons
- referral data
- non-order rewards/accrual history

## Error Handling

- User edit flows keep showing current save error UI.
- `AdminAuthGate` becomes read-only; failures show forbidden instead of mutating data.
- `admin-user-create` rolls back created records if rewards initialization fails.
- Cleanup SQL stays transactional with `begin/commit`.

## Verification

- Disable a customer/admin/merchant, edit profile fields, save, and confirm status remains disabled.
- Access admin pages with a session whose profile lookup fails and confirm no row is inserted.
- Create a customer from admin and confirm `official_member_rewards_accounts` exists immediately.
- Run cleanup SQL on test data and confirm:
  - orders and dependent order tables are cleared
  - order-paid points ledger rows are cleared
  - users, products, coupons, referrals remain
