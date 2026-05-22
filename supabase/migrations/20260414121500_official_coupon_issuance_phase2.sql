create table if not exists public.official_coupon_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  discount_type text not null check (discount_type in ('percent', 'fixed_amount')),
  percent_off numeric(12,4),
  amount_off_myr numeric(12,2),
  amount_off_sgd numeric(12,2),
  min_spend_myr numeric(12,2) not null default 0,
  min_spend_sgd numeric(12,2) not null default 0,
  points_cost numeric(12,2) not null default 0,
  is_points_redeemable boolean not null default false,
  status text not null default 'enabled' check (status in ('enabled', 'disabled')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ck_official_coupon_templates_value check (
    (discount_type = 'percent' and percent_off is not null and amount_off_myr is null and amount_off_sgd is null)
    or
    (discount_type = 'fixed_amount' and (amount_off_myr is not null or amount_off_sgd is not null) and percent_off is null)
  )
);

create table if not exists public.official_coupon_issuance_rules (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  status text not null default 'enabled' check (status in ('enabled', 'disabled')),
  trigger_type text not null check (trigger_type in ('birthday_month', 'new_registration', 'manual_batch')),
  template_id uuid not null references public.official_coupon_templates(id) on delete cascade,
  applies_tiers text[] not null default '{none,bronze,silver,gold}'::text[],
  valid_days integer not null default 30 check (valid_days > 0 and valid_days <= 365),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.official_user_coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.official_profiles(id) on delete cascade,
  template_id uuid not null references public.official_coupon_templates(id) on delete restrict,
  issuance_rule_id uuid references public.official_coupon_issuance_rules(id) on delete set null,
  status text not null default 'issued' check (status in ('issued', 'redeemed', 'expired', 'revoked')),
  issued_by uuid references public.official_profiles(id) on delete set null,
  issued_reason text not null default 'manual_issue' check (issued_reason in ('manual_issue', 'points_redeem', 'birthday_auto', 'registration_auto', 'rule_auto')),
  points_cost numeric(12,2) not null default 0,
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  revoked_at timestamptz,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists idx_official_coupon_templates_status on public.official_coupon_templates(status, starts_at, ends_at);
create index if not exists idx_official_coupon_issuance_rules_status on public.official_coupon_issuance_rules(status, trigger_type);
create index if not exists idx_official_user_coupons_user_status on public.official_user_coupons(user_id, status, issued_at desc);
create index if not exists idx_official_user_coupons_template_status on public.official_user_coupons(template_id, status, issued_at desc);

create or replace function public.official_issue_coupon_to_user(
  p_user_id uuid,
  p_template_id uuid,
  p_issued_by uuid default null,
  p_issued_reason text default 'manual_issue',
  p_issuance_rule_id uuid default null,
  p_points_cost numeric default 0,
  p_expires_at timestamptz default null,
  p_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.official_user_coupons (
    user_id,
    template_id,
    issuance_rule_id,
    issued_by,
    issued_reason,
    points_cost,
    expires_at,
    meta
  )
  values (
    p_user_id,
    p_template_id,
    p_issuance_rule_id,
    p_issued_by,
    p_issued_reason,
    coalesce(p_points_cost, 0),
    p_expires_at,
    coalesce(p_meta, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

alter table public.official_coupon_templates enable row level security;
alter table public.official_coupon_issuance_rules enable row level security;
alter table public.official_user_coupons enable row level security;

drop policy if exists "official_coupon_templates_public_read" on public.official_coupon_templates;
drop policy if exists "official_coupon_templates_admin_write" on public.official_coupon_templates;
create policy "official_coupon_templates_public_read"
on public.official_coupon_templates for select
using (status = 'enabled' or public.official_is_admin());
create policy "official_coupon_templates_admin_write"
on public.official_coupon_templates for all
using (public.official_is_admin())
with check (public.official_is_admin());

drop policy if exists "official_coupon_issuance_rules_admin_read_write" on public.official_coupon_issuance_rules;
create policy "official_coupon_issuance_rules_admin_read_write"
on public.official_coupon_issuance_rules for all
using (public.official_is_admin())
with check (public.official_is_admin());

drop policy if exists "official_user_coupons_owner_or_admin_read" on public.official_user_coupons;
drop policy if exists "official_user_coupons_admin_write" on public.official_user_coupons;
create policy "official_user_coupons_owner_or_admin_read"
on public.official_user_coupons for select
using (user_id = auth.uid() or public.official_is_admin());
create policy "official_user_coupons_admin_write"
on public.official_user_coupons for all
using (public.official_is_admin())
with check (public.official_is_admin());

grant execute on function public.official_issue_coupon_to_user(uuid, uuid, uuid, text, uuid, numeric, timestamptz, jsonb) to authenticated;
