# Admin And Order History Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the confirmed admin user-state bugs, harden admin auth gating, ensure admin-created customers get rewards initialization, and make order-history cleanup SQL match the intended preserved data scope.

**Architecture:** Keep the fixes minimal and local to the affected flows. Preserve existing UI structure, correct the bad state transitions at the point of mutation, remove unsafe auth-gate writes, and make the cleanup SQL explicit about order-derived records instead of relying on partial cascading behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, Supabase Edge Functions, PostgreSQL SQL scripts

---

### Task 1: Preserve Existing User Status During Admin Edits

**Files:**
- Modify: `src/app/admin/users/customers/page.tsx`
- Modify: `src/app/admin/users/admins/page.tsx`
- Modify: `src/app/admin/users/merchants/page.tsx`

- [ ] **Step 1: Add edit-status state to the customer admin page**

```tsx
const [editStatus, setEditStatus] = useState<OfficialProfileRow["status"]>("active");
```

Also update `startEdit()` to capture the current row status:

```tsx
const startEdit = (row: OfficialProfileRow) => {
  const addressParts = splitAddressParts(row.address);
  setEditId(row.id);
  setEditName(row.full_name ?? "");
  setEditPhone(row.phone ?? "");
  setEditEmail(row.email ?? "");
  setEditAddress1(addressParts.address1);
  setEditAddress2(addressParts.address2);
  setEditPostalCode(addressParts.postalCode);
  setEditState(addressParts.state);
  setEditCountry(addressParts.country);
  setEditBirthDate(row.birth_date ?? "");
  setEditStatus(row.status);
  setEditMessage(null);
  setShowEditModal(true);
};
```

- [ ] **Step 2: Submit preserved customer status instead of hardcoding `active`**

Replace the save payload in `src/app/admin/users/customers/page.tsx`:

```tsx
const update = await updateOfficialProfileDetail({
  id: editId,
  full_name: editName,
  phone: normalizedPhone,
  email: editEmail,
  address: mergedAddress,
  birth_date: editBirthDate,
  role: "customer",
  status: editStatus,
});
```

- [ ] **Step 3: Add edit-status state to the admin user page**

```tsx
const [editStatus, setEditStatus] = useState<OfficialProfileRow["status"]>("active");
```

Capture it in `startEdit()`:

```tsx
const startEdit = (row: OfficialProfileRow) => {
  setEditId(row.id);
  setEditName(row.full_name ?? "");
  setEditEmail(row.email ?? "");
  setEditRole(row.role);
  setEditStatus(row.status);
  setEditMessage(null);
  setShowEditModal(true);
};
```

- [ ] **Step 4: Submit preserved admin status instead of hardcoding `active`**

Replace the save payload in `src/app/admin/users/admins/page.tsx`:

```tsx
const update = await updateOfficialProfileDetail({
  id: editId,
  full_name: editName,
  email: editEmail,
  role: editRole,
  status: editStatus,
});
```

- [ ] **Step 5: Add edit-status state to the merchant user page**

```tsx
const [editStatus, setEditStatus] = useState<OfficialProfileRow["status"]>("active");
```

Capture it in `startEdit()`:

```tsx
const startEdit = (row: OfficialProfileRow) => {
  setEditId(row.id);
  setEditName(row.full_name ?? "");
  setEditPhone(row.phone ?? "");
  setEditEmail(row.email ?? "");
  setEditAvatarUrl(row.avatar_url ?? "");
  setEditAddress(row.address ?? "");
  setEditOutletId(merchantMap.get(row.id)?.outlet_id ?? "");
  setEditStatus(row.status);
  setEditMessage(null);
  setShowEditModal(true);
};
```

- [ ] **Step 6: Submit preserved merchant status and sync merchant account status**

Replace the profile update and merchant account update in `src/app/admin/users/merchants/page.tsx`:

```tsx
const profileUpdate = await updateOfficialProfileDetail({
  id: editId,
  full_name: editName,
  phone: normalizedPhone,
  email: editEmail,
  avatar_url: editAvatarUrl,
  address: editAddress,
  role: "merchant",
  status: editStatus,
});
```

```tsx
const merchantUpdate = await upsertOfficialMerchantAccount({
  profile_id: editId,
  outlet_id: editOutletId,
  status: editStatus === "active" ? "active" : "disabled",
});
```

- [ ] **Step 7: Run targeted diagnostics**

Run:

```bash
npx eslint src/app/admin/users/customers/page.tsx src/app/admin/users/admins/page.tsx src/app/admin/users/merchants/page.tsx
```

Expected: no new lint errors in the three edited files.

- [ ] **Step 8: Commit**

```bash
git add src/app/admin/users/customers/page.tsx src/app/admin/users/admins/page.tsx src/app/admin/users/merchants/page.tsx
git commit -m "fix: preserve user status during admin edits"
```

### Task 2: Make Admin Auth Gate Read-Only and Fail Closed

**Files:**
- Modify: `src/components/admin-auth-gate.tsx`

- [ ] **Step 1: Reorder profile lookup handling so errors are checked first**

Replace the unsafe branch block in `src/components/admin-auth-gate.tsx`:

```tsx
if (error) {
  setState({ kind: "forbidden" });
  return;
}

if (!profile) {
  setState({ kind: "forbidden" });
  return;
}
```

Remove this existing write entirely:

```tsx
await client.from("official_profiles").upsert({ id: session.user.id, status: "active" }, { onConflict: "id" });
```

- [ ] **Step 2: Keep the gate behavior otherwise unchanged**

The surrounding logic should remain:

```tsx
if (profile.status !== "active") {
  setState({ kind: "forbidden" });
  return;
}

if (profile.role !== "admin" && profile.role !== "super_admin") {
  setState({ kind: "forbidden" });
  return;
}
```

This makes the gate read-only and prevents dirty profile creation during transient failures.

- [ ] **Step 3: Run targeted diagnostics**

Run:

```bash
npx eslint src/components/admin-auth-gate.tsx
```

Expected: no new lint errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin-auth-gate.tsx
git commit -m "fix: make admin auth gate fail closed"
```

### Task 3: Initialize Rewards Accounts for Admin-Created Customers

**Files:**
- Modify: `supabase/functions/admin-user-create/index.ts`
- Reference: `supabase/functions/member-rewards-card/index.ts`

- [ ] **Step 1: Add a local helper in `admin-user-create` to initialize rewards account records**

Insert this helper above `serve(...)` in `supabase/functions/admin-user-create/index.ts`:

```ts
async function ensureMemberRewardsAccount(supabase: ReturnType<typeof getSupabaseAdminClient>, userId: string) {
  if (!supabase || !userId) return { ok: false as const, message: "Missing Supabase or userId" };

  await supabase.rpc("official_bind_referral_from_user_metadata", { p_user_id: userId });

  const account = await supabase
    .from("official_member_rewards_accounts")
    .select("user_id,rewards_code,qr_payload,status")
    .eq("user_id", userId)
    .maybeSingle();

  if (account.error) {
    return { ok: false as const, message: account.error.message };
  }

  if (!account.data?.user_id) {
    const created = await supabase
      .from("official_member_rewards_accounts")
      .insert({ user_id: userId, status: "active" })
      .select("user_id,rewards_code,qr_payload,status")
      .maybeSingle();

    if (created.error || !created.data?.user_id) {
      return { ok: false as const, message: created.error?.message ?? "Create rewards account failed" };
    }

    if (!created.data.qr_payload && created.data.rewards_code) {
      const updateQr = await supabase
        .from("official_member_rewards_accounts")
        .update({ qr_payload: created.data.rewards_code })
        .eq("user_id", userId);
      if (updateQr.error) return { ok: false as const, message: updateQr.error.message };
    }

    return { ok: true as const };
  }

  if (!account.data.qr_payload && account.data.rewards_code) {
    const updateQr = await supabase
      .from("official_member_rewards_accounts")
      .update({ qr_payload: account.data.rewards_code })
      .eq("user_id", userId);
    if (updateQr.error) return { ok: false as const, message: updateQr.error.message };
  }

  return { ok: true as const };
}
```

- [ ] **Step 2: Call the helper after the profile upsert for `customer`**

Add this block after the merchant section and before the final success response:

```ts
if (role === "customer") {
  const rewardsInit = await ensureMemberRewardsAccount(supabase, createdAuth.data.user.id);
  if (!rewardsInit.ok) {
    await supabase.from("official_profiles").delete().eq("id", createdAuth.data.user.id);
    await supabase.auth.admin.deleteUser(createdAuth.data.user.id);
    return new Response(JSON.stringify({ message: rewardsInit.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}
```

Keep the existing explicit referral binding block only if you want the direct referral-code error surfaced during admin create; otherwise remove the duplicate customer referral call and rely on `official_bind_referral_from_user_metadata`. The minimal consistent version is to delete this block:

```ts
if (role === "customer" && referralCode) {
  const referralBind = await supabase.rpc("official_bind_referral_by_code", {
    p_referred_user_id: createdAuth.data.user.id,
    p_referral_code: referralCode,
  });
  ...
}
```

because the helper already calls:

```ts
await supabase.rpc("official_bind_referral_from_user_metadata", { p_user_id: userId });
```

- [ ] **Step 3: Run targeted diagnostics**

Run:

```bash
npx eslint supabase/functions/admin-user-create/index.ts
```

Expected: no new lint errors in the edge function file.

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/admin-user-create/index.ts
git commit -m "fix: initialize rewards for admin-created customers"
```

### Task 4: Make Order-History Cleanup SQL Remove Order-Derived History

**Files:**
- Modify: `supabase/sql/clear-order-history-keep-users-and-products.sql`

- [ ] **Step 1: Null coupon order references before deleting orders**

Replace the body of the SQL file with:

```sql
begin;

update public.official_user_coupons
set
  reserved_order_id = null,
  reserved_at = null,
  redeemed_order_id = null
where reserved_order_id is not null
   or redeemed_order_id is not null;

delete from public.official_points_ledger
where source_type = 'order_paid';

delete from public.official_orders;

commit;
```

- [ ] **Step 2: Update the explanatory comments so they match the real behavior**

Keep a comment block like this at the top of the file:

```sql
-- Preserve:
-- - auth.users
-- - official_profiles
-- - official_user_coupons
-- - official_menu_*
-- - official_soup_pack_*
-- - official_outlets
-- - referral data
-- - non-order member rewards/accrual history
--
-- Remove:
-- - official_orders
-- - official_order_items
-- - official_order_adjustments
-- - official_payments
-- - official_payment_contexts
-- - official_deliveries
-- - official_delivery_events
-- - order-derived points ledger rows (`source_type = 'order_paid'`)
```

- [ ] **Step 3: Review the SQL file manually for transaction safety**

Expected final structure:

```sql
begin;
...
commit;
```

There must be no `truncate ... cascade` in the final file.

- [ ] **Step 4: Commit**

```bash
git add supabase/sql/clear-order-history-keep-users-and-products.sql
git commit -m "fix: align order history cleanup with preserved data scope"
```

### Task 5: Final Verification Pass

**Files:**
- Modify: none
- Verify: `src/app/admin/users/customers/page.tsx`
- Verify: `src/app/admin/users/admins/page.tsx`
- Verify: `src/app/admin/users/merchants/page.tsx`
- Verify: `src/components/admin-auth-gate.tsx`
- Verify: `supabase/functions/admin-user-create/index.ts`
- Verify: `supabase/sql/clear-order-history-keep-users-and-products.sql`

- [ ] **Step 1: Run targeted lint/diagnostic checks for all modified TypeScript files**

Run:

```bash
npx eslint src/app/admin/users/customers/page.tsx src/app/admin/users/admins/page.tsx src/app/admin/users/merchants/page.tsx src/components/admin-auth-gate.tsx supabase/functions/admin-user-create/index.ts
```

Expected: no new lint errors in edited files.

- [ ] **Step 2: Verify editor diagnostics**

Run editor diagnostics and confirm no new issues exist in:

```text
src/app/admin/users/customers/page.tsx
src/app/admin/users/admins/page.tsx
src/app/admin/users/merchants/page.tsx
src/components/admin-auth-gate.tsx
supabase/functions/admin-user-create/index.ts
```

Expected: empty or unchanged diagnostics.

- [ ] **Step 3: Smoke-check the fixed behaviors**

Manually verify these scenarios:

```text
1. Disable a customer, edit profile fields, save, status remains disabled.
2. Disable an admin, edit profile fields, save, status remains disabled.
3. Disable a merchant, edit profile fields, save, status remains disabled.
4. Admin login gate with missing/failed profile lookup shows forbidden and writes nothing.
5. Admin-created customer has an immediate official_member_rewards_accounts row.
6. Cleanup SQL removes orders and order-paid points rows, but preserves users/products/coupons.
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/users/customers/page.tsx src/app/admin/users/admins/page.tsx src/app/admin/users/merchants/page.tsx src/components/admin-auth-gate.tsx supabase/functions/admin-user-create/index.ts supabase/sql/clear-order-history-keep-users-and-products.sql
git commit -m "fix: close admin and order history logic gaps"
```
