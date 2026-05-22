alter table public.official_profiles
add column if not exists membership_tier text not null default 'none' check (membership_tier in ('none', 'bronze', 'silver', 'gold')),
add column if not exists membership_activated_at timestamptz,
add column if not exists last_consumed_at timestamptz,
add column if not exists cumulative_spend_myr numeric(12,2) not null default 0;

create table if not exists public.official_member_rewards_accounts (
  user_id uuid primary key references public.official_profiles(id) on delete cascade,
  rewards_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  qr_payload text,
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.official_merchant_accounts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.official_profiles(id) on delete cascade,
  outlet_id uuid not null references public.official_outlets(id) on delete restrict,
  permissions jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.official_member_rewards_accruals (
  id uuid primary key default gen_random_uuid(),
  member_user_id uuid not null references public.official_profiles(id) on delete restrict,
  merchant_id uuid not null references public.official_merchant_accounts(id) on delete restrict,
  outlet_id uuid not null references public.official_outlets(id) on delete restrict,
  spend_amount numeric(12,2) not null check (spend_amount > 0),
  points_amount numeric(12,2) not null default 0 check (points_amount >= 0),
  receipt_url text not null,
  receipt_fingerprint text,
  status text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.official_profiles(id) on delete set null,
  reject_reason text
);

create table if not exists public.official_member_rewards_points_ledger (
  id uuid primary key default gen_random_uuid(),
  accrual_id uuid references public.official_member_rewards_accruals(id) on delete set null,
  user_id uuid not null references public.official_profiles(id) on delete cascade,
  points_delta numeric(12,2) not null,
  source text not null default 'merchant_accrual',
  created_at timestamptz not null default now()
);

create table if not exists public.official_membership_tier_rules (
  id uuid primary key default gen_random_uuid(),
  tier text not null unique check (tier in ('bronze', 'silver', 'gold')),
  min_spend_myr numeric(12,2) not null default 0,
  max_spend_myr numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.official_referral_reward_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  reward_type text not null check (reward_type in ('cashback', 'coupon')),
  calc_kind text not null check (calc_kind in ('percent', 'fixed')),
  calc_value numeric(12,4) not null check (calc_value >= 0),
  reward_cap_myr numeric(12,2),
  min_order_myr numeric(12,2) not null default 0,
  channels text[] not null default '{all}'::text[],
  validity_days integer not null default 30,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_official_rewards_accounts_code on public.official_member_rewards_accounts(rewards_code);
create index if not exists idx_official_merchant_accounts_outlet on public.official_merchant_accounts(outlet_id);
create index if not exists idx_official_rewards_accruals_member on public.official_member_rewards_accruals(member_user_id);
create index if not exists idx_official_rewards_accruals_merchant on public.official_member_rewards_accruals(merchant_id);
create index if not exists idx_official_rewards_accruals_status on public.official_member_rewards_accruals(status, submitted_at desc);
create unique index if not exists uq_official_rewards_receipt_fingerprint
on public.official_member_rewards_accruals(receipt_fingerprint)
where receipt_fingerprint is not null;
create index if not exists idx_official_rewards_points_ledger_user on public.official_member_rewards_points_ledger(user_id, created_at desc);

create or replace function public.official_is_merchant()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.official_merchant_accounts m
    where m.profile_id = auth.uid()
      and m.status = 'active'
  );
$$;

alter table public.official_member_rewards_accounts enable row level security;
alter table public.official_merchant_accounts enable row level security;
alter table public.official_member_rewards_accruals enable row level security;
alter table public.official_member_rewards_points_ledger enable row level security;
alter table public.official_membership_tier_rules enable row level security;
alter table public.official_referral_reward_rules enable row level security;

drop policy if exists "official_member_rewards_accounts_self_or_admin_read" on public.official_member_rewards_accounts;
drop policy if exists "official_member_rewards_accounts_admin_write" on public.official_member_rewards_accounts;
create policy "official_member_rewards_accounts_self_or_admin_read"
on public.official_member_rewards_accounts for select
using (user_id = auth.uid() or public.official_is_admin());
create policy "official_member_rewards_accounts_admin_write"
on public.official_member_rewards_accounts for all
using (public.official_is_admin())
with check (public.official_is_admin());

drop policy if exists "official_merchant_accounts_self_or_admin_read" on public.official_merchant_accounts;
drop policy if exists "official_merchant_accounts_admin_write" on public.official_merchant_accounts;
create policy "official_merchant_accounts_self_or_admin_read"
on public.official_merchant_accounts for select
using (profile_id = auth.uid() or public.official_is_admin());
create policy "official_merchant_accounts_admin_write"
on public.official_merchant_accounts for all
using (public.official_is_admin())
with check (public.official_is_admin());

drop policy if exists "official_member_rewards_accruals_member_merchant_admin_read" on public.official_member_rewards_accruals;
drop policy if exists "official_member_rewards_accruals_merchant_submit" on public.official_member_rewards_accruals;
drop policy if exists "official_member_rewards_accruals_admin_review" on public.official_member_rewards_accruals;
create policy "official_member_rewards_accruals_member_merchant_admin_read"
on public.official_member_rewards_accruals for select
using (
  member_user_id = auth.uid()
  or public.official_is_admin()
  or exists(
    select 1
    from public.official_merchant_accounts m
    where m.id = official_member_rewards_accruals.merchant_id
      and m.profile_id = auth.uid()
      and m.status = 'active'
  )
);
create policy "official_member_rewards_accruals_merchant_submit"
on public.official_member_rewards_accruals for insert
with check (
  public.official_is_admin()
  or exists(
    select 1
    from public.official_merchant_accounts m
    where m.id = merchant_id
      and m.profile_id = auth.uid()
      and m.status = 'active'
  )
);
create policy "official_member_rewards_accruals_admin_review"
on public.official_member_rewards_accruals for update
using (public.official_is_admin())
with check (public.official_is_admin());

drop policy if exists "official_member_rewards_points_ledger_owner_or_admin_read" on public.official_member_rewards_points_ledger;
drop policy if exists "official_member_rewards_points_ledger_admin_write" on public.official_member_rewards_points_ledger;
create policy "official_member_rewards_points_ledger_owner_or_admin_read"
on public.official_member_rewards_points_ledger for select
using (user_id = auth.uid() or public.official_is_admin());
create policy "official_member_rewards_points_ledger_admin_write"
on public.official_member_rewards_points_ledger for all
using (public.official_is_admin())
with check (public.official_is_admin());

drop policy if exists "official_membership_tier_rules_public_read" on public.official_membership_tier_rules;
drop policy if exists "official_membership_tier_rules_admin_write" on public.official_membership_tier_rules;
create policy "official_membership_tier_rules_public_read"
on public.official_membership_tier_rules for select
using (true);
create policy "official_membership_tier_rules_admin_write"
on public.official_membership_tier_rules for all
using (public.official_is_admin())
with check (public.official_is_admin());

drop policy if exists "official_referral_reward_rules_public_read" on public.official_referral_reward_rules;
drop policy if exists "official_referral_reward_rules_admin_write" on public.official_referral_reward_rules;
create policy "official_referral_reward_rules_public_read"
on public.official_referral_reward_rules for select
using (true);
create policy "official_referral_reward_rules_admin_write"
on public.official_referral_reward_rules for all
using (public.official_is_admin())
with check (public.official_is_admin());

insert into public.official_membership_tier_rules (tier, min_spend_myr, max_spend_myr, is_active)
values
  ('bronze', 0, 999, true),
  ('silver', 1000, 4999, true),
  ('gold', 5000, null, true)
on conflict (tier) do update
set min_spend_myr = excluded.min_spend_myr,
    max_spend_myr = excluded.max_spend_myr,
    is_active = excluded.is_active;
