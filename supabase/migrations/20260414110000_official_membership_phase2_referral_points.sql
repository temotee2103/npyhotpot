create table if not exists public.official_referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.official_profiles(id) on delete restrict,
  referred_user_id uuid not null unique references public.official_profiles(id) on delete cascade,
  referral_code text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now()
);

create table if not exists public.official_points_campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  status text not null default 'active' check (status in ('active', 'disabled')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  apply_self boolean not null default true,
  apply_upline boolean not null default false,
  self_multiplier numeric(12,4) not null default 1 check (self_multiplier > 0),
  upline_multiplier numeric(12,4) not null default 1 check (upline_multiplier > 0),
  channels text[] not null default '{all}'::text[],
  tiers text[] not null default '{none,bronze,silver,gold}'::text[],
  overlap_strategy text not null default 'max_only' check (overlap_strategy in ('max_only')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.official_points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.official_profiles(id) on delete cascade,
  source_type text not null,
  source_id text not null,
  channel text not null default 'all' check (channel in ('shop', 'delivery', 'dine_in', 'all')),
  event_at timestamptz not null default now(),
  points_delta numeric(12,4) not null,
  reason text not null check (reason in ('self_earn', 'upline_rebate', 'redeem_deduction', 'admin_adjustment')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_official_referrals_referrer on public.official_referrals(referrer_user_id, created_at desc);
create index if not exists idx_official_referrals_referred on public.official_referrals(referred_user_id, created_at desc);
create index if not exists idx_official_points_campaigns_active_window on public.official_points_campaigns(status, starts_at, ends_at);
create index if not exists idx_official_points_ledger_user_created on public.official_points_ledger(user_id, created_at desc);
create unique index if not exists uq_official_points_ledger_source_user_reason
on public.official_points_ledger(user_id, source_type, source_id, reason)
where reason in ('self_earn', 'upline_rebate');

create or replace function public.official_referral_code_for_user(p_user_id uuid)
returns text
language sql
immutable
as $$
  select upper('NPY' || substr(replace(p_user_id::text, '-', ''), 1, 8));
$$;

create or replace function public.official_upline_rebate_base_rate(p_tier text)
returns numeric
language sql
immutable
as $$
  select case lower(coalesce(p_tier, 'none'))
    when 'bronze' then 0.25
    when 'silver' then 0.50
    when 'gold' then 0.75
    else 0
  end;
$$;

create or replace function public.official_resolve_membership_tier(p_cumulative_spend_myr numeric)
returns text
language sql
immutable
as $$
  select case
    when coalesce(p_cumulative_spend_myr, 0) >= 5000 then 'gold'
    when coalesce(p_cumulative_spend_myr, 0) >= 1000 then 'silver'
    when coalesce(p_cumulative_spend_myr, 0) >= 30 then 'bronze'
    else 'none'
  end;
$$;

create or replace function public.official_resolve_points_multiplier(
  p_for_upline boolean,
  p_channel text,
  p_tier text,
  p_event_at timestamptz
)
returns numeric
language sql
stable
as $$
  with matched as (
    select
      case
        when p_for_upline then
          case when c.apply_upline then c.upline_multiplier else null end
        else
          case when c.apply_self then c.self_multiplier else null end
      end as multiplier
    from public.official_points_campaigns c
    where c.status = 'active'
      and c.starts_at <= p_event_at
      and (c.ends_at is null or c.ends_at >= p_event_at)
      and (coalesce(array_length(c.channels, 1), 0) = 0 or c.channels @> array['all']::text[] or c.channels @> array[p_channel]::text[])
      and (coalesce(array_length(c.tiers, 1), 0) = 0 or c.tiers @> array[coalesce(p_tier, 'none')]::text[])
      and c.overlap_strategy = 'max_only'
  )
  select coalesce(max(multiplier), 1)::numeric
  from matched
  where multiplier is not null;
$$;

create or replace function public.official_bind_referral_by_code(
  p_referred_user_id uuid,
  p_referral_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(coalesce(p_referral_code, '')));
  v_referrer_id uuid;
  v_inserted boolean := false;
begin
  if p_referred_user_id is null then
    return jsonb_build_object('bound', false, 'reason', 'missing_user');
  end if;
  if v_code = '' then
    return jsonb_build_object('bound', false, 'reason', 'missing_code');
  end if;
  if v_code = public.official_referral_code_for_user(p_referred_user_id) then
    return jsonb_build_object('bound', false, 'reason', 'self_referral');
  end if;

  select p.id
  into v_referrer_id
  from public.official_profiles p
  where public.official_referral_code_for_user(p.id) = v_code
  limit 1;

  if v_referrer_id is null then
    return jsonb_build_object('bound', false, 'reason', 'referrer_not_found');
  end if;

  insert into public.official_referrals (referrer_user_id, referred_user_id, referral_code, status)
  values (v_referrer_id, p_referred_user_id, v_code, 'active')
  on conflict (referred_user_id) do nothing;

  get diagnostics v_inserted = row_count;
  return jsonb_build_object(
    'bound', v_inserted,
    'reason', case when v_inserted then 'bound' else 'already_bound' end,
    'referrer_user_id', v_referrer_id
  );
end;
$$;

create or replace function public.official_bind_referral_from_user_metadata(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_referral_code text;
begin
  if p_user_id is null then
    return jsonb_build_object('bound', false, 'reason', 'missing_user');
  end if;

  select trim(coalesce((u.raw_user_meta_data ->> 'referral_code'), ''))
  into v_referral_code
  from auth.users u
  where u.id = p_user_id
  limit 1;

  return public.official_bind_referral_by_code(p_user_id, v_referral_code);
end;
$$;

create or replace function public.official_post_points_for_consumption(
  p_consumer_user_id uuid,
  p_spend_amount numeric,
  p_source_type text,
  p_source_id text,
  p_channel text,
  p_event_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consumer_profile record;
  v_referral_row record;
  v_upline_profile record;
  v_self_multiplier numeric := 1;
  v_upline_multiplier numeric := 1;
  v_self_points numeric := 0;
  v_upline_points numeric := 0;
  v_upline_base_rate numeric := 0;
  v_self_inserted boolean := false;
  v_upline_inserted boolean := false;
  v_next_spend numeric := 0;
  v_next_tier text := 'none';
begin
  if p_consumer_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_consumer');
  end if;
  if coalesce(p_spend_amount, 0) <= 0 then
    return jsonb_build_object('ok', false, 'reason', 'invalid_spend');
  end if;
  if trim(coalesce(p_source_type, '')) = '' or trim(coalesce(p_source_id, '')) = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_source');
  end if;

  select id, membership_tier, cumulative_spend_myr
  into v_consumer_profile
  from public.official_profiles
  where id = p_consumer_user_id
  limit 1;

  if v_consumer_profile.id is null then
    return jsonb_build_object('ok', false, 'reason', 'consumer_not_found');
  end if;

  v_self_multiplier := public.official_resolve_points_multiplier(false, coalesce(p_channel, 'all'), coalesce(v_consumer_profile.membership_tier, 'none'), p_event_at);
  v_self_points := round((p_spend_amount * 1 * v_self_multiplier)::numeric, 4);

  insert into public.official_points_ledger (
    user_id, source_type, source_id, channel, event_at, points_delta, reason, meta
  )
  values (
    p_consumer_user_id,
    p_source_type,
    p_source_id,
    coalesce(p_channel, 'all'),
    p_event_at,
    v_self_points,
    'self_earn',
    jsonb_build_object('spend_amount', p_spend_amount, 'multiplier', v_self_multiplier)
  )
  on conflict (user_id, source_type, source_id, reason) do nothing;
  get diagnostics v_self_inserted = row_count;

  if v_self_inserted then
    v_next_spend := round((coalesce(v_consumer_profile.cumulative_spend_myr, 0) + p_spend_amount)::numeric, 2);
    v_next_tier := public.official_resolve_membership_tier(v_next_spend);
    update public.official_profiles
    set cumulative_spend_myr = v_next_spend,
        last_consumed_at = p_event_at,
        membership_tier = v_next_tier,
        membership_activated_at = case
          when membership_activated_at is null and v_next_spend >= 30 then p_event_at
          else membership_activated_at
        end
    where id = p_consumer_user_id;
  else
    v_next_spend := coalesce(v_consumer_profile.cumulative_spend_myr, 0);
    v_next_tier := coalesce(v_consumer_profile.membership_tier, 'none');
  end if;

  select referrer_user_id, referred_user_id
  into v_referral_row
  from public.official_referrals
  where referred_user_id = p_consumer_user_id
    and status = 'active'
  limit 1;

  if v_referral_row.referrer_user_id is not null then
    select id, membership_tier
    into v_upline_profile
    from public.official_profiles
    where id = v_referral_row.referrer_user_id
    limit 1;

    if v_upline_profile.id is not null then
      v_upline_base_rate := public.official_upline_rebate_base_rate(v_upline_profile.membership_tier);
      if v_upline_base_rate > 0 then
        v_upline_multiplier := public.official_resolve_points_multiplier(true, coalesce(p_channel, 'all'), coalesce(v_upline_profile.membership_tier, 'none'), p_event_at);
        v_upline_points := round((p_spend_amount * v_upline_base_rate * v_upline_multiplier)::numeric, 4);
        insert into public.official_points_ledger (
          user_id, source_type, source_id, channel, event_at, points_delta, reason, meta
        )
        values (
          v_upline_profile.id,
          p_source_type,
          p_source_id,
          coalesce(p_channel, 'all'),
          p_event_at,
          v_upline_points,
          'upline_rebate',
          jsonb_build_object(
            'consumer_user_id', p_consumer_user_id,
            'base_rate', v_upline_base_rate,
            'multiplier', v_upline_multiplier,
            'spend_amount', p_spend_amount
          )
        )
        on conflict (user_id, source_type, source_id, reason) do nothing;
        get diagnostics v_upline_inserted = row_count;
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'self_inserted', v_self_inserted,
    'self_points', v_self_points,
    'upline_inserted', v_upline_inserted,
    'upline_points', v_upline_points,
    'consumer_next_spend', v_next_spend,
    'consumer_next_tier', v_next_tier
  );
end;
$$;

alter table public.official_referrals enable row level security;
alter table public.official_points_campaigns enable row level security;
alter table public.official_points_ledger enable row level security;

drop policy if exists "official_referrals_owner_or_admin_read" on public.official_referrals;
drop policy if exists "official_referrals_admin_write" on public.official_referrals;
create policy "official_referrals_owner_or_admin_read"
on public.official_referrals for select
using (referrer_user_id = auth.uid() or referred_user_id = auth.uid() or public.official_is_admin());
create policy "official_referrals_admin_write"
on public.official_referrals for all
using (public.official_is_admin())
with check (public.official_is_admin());

drop policy if exists "official_points_campaigns_public_read" on public.official_points_campaigns;
drop policy if exists "official_points_campaigns_admin_write" on public.official_points_campaigns;
create policy "official_points_campaigns_public_read"
on public.official_points_campaigns for select
using (true);
create policy "official_points_campaigns_admin_write"
on public.official_points_campaigns for all
using (public.official_is_admin())
with check (public.official_is_admin());

drop policy if exists "official_points_ledger_owner_or_admin_read" on public.official_points_ledger;
drop policy if exists "official_points_ledger_admin_write" on public.official_points_ledger;
create policy "official_points_ledger_owner_or_admin_read"
on public.official_points_ledger for select
using (user_id = auth.uid() or public.official_is_admin());
create policy "official_points_ledger_admin_write"
on public.official_points_ledger for all
using (public.official_is_admin())
with check (public.official_is_admin());

grant execute on function public.official_bind_referral_from_user_metadata(uuid) to authenticated;
