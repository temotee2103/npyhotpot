alter table public.official_coupon_issuance_rules
add column if not exists trigger_config jsonb not null default '{}'::jsonb;

alter table public.official_coupon_issuance_rules
drop constraint if exists official_coupon_issuance_rules_trigger_type_check;

alter table public.official_coupon_issuance_rules
add constraint official_coupon_issuance_rules_trigger_type_check
check (trigger_type in ('birthday_month', 'new_registration', 'calendar_window', 'manual_batch'));

create or replace function public.official_issue_coupon_by_rule_for_user(
  p_rule_id uuid,
  p_user_id uuid,
  p_cycle_key text,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rule public.official_coupon_issuance_rules%rowtype;
  v_template public.official_coupon_templates%rowtype;
  v_profile record;
  v_existing_coupon_id uuid;
  v_coupon_id uuid;
  v_expires_at timestamptz;
  v_issued_reason text := 'rule_auto';
begin
  if p_rule_id is null or p_user_id is null or trim(coalesce(p_cycle_key, '')) = '' then
    return jsonb_build_object('ok', false, 'reason', 'missing_required_fields');
  end if;

  select *
  into v_rule
  from public.official_coupon_issuance_rules
  where id = p_rule_id
    and status = 'enabled'
  limit 1;

  if v_rule.id is null then
    return jsonb_build_object('ok', false, 'reason', 'rule_not_found');
  end if;

  select *
  into v_template
  from public.official_coupon_templates
  where id = v_rule.template_id
    and status = 'enabled'
    and (starts_at is null or starts_at <= p_now)
    and (ends_at is null or ends_at >= p_now)
  limit 1;

  if v_template.id is null then
    return jsonb_build_object('ok', false, 'reason', 'template_not_available');
  end if;

  select id, membership_tier
  into v_profile
  from public.official_profiles
  where id = p_user_id
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  end if;

  if not (v_rule.applies_tiers @> array[coalesce(v_profile.membership_tier, 'none')]::text[]) then
    return jsonb_build_object('ok', false, 'reason', 'tier_not_eligible');
  end if;

  select id
  into v_existing_coupon_id
  from public.official_user_coupons
  where user_id = p_user_id
    and issuance_rule_id = p_rule_id
    and coalesce(meta ->> 'cycle_key', '') = p_cycle_key
  limit 1;

  if v_existing_coupon_id is not null then
    return jsonb_build_object('ok', true, 'issued', false, 'reason', 'already_issued', 'coupon_id', v_existing_coupon_id);
  end if;

  v_expires_at := p_now + make_interval(days => greatest(v_rule.valid_days, 1));
  if v_template.ends_at is not null and v_template.ends_at < v_expires_at then
    v_expires_at := v_template.ends_at;
  end if;

  if v_rule.trigger_type = 'birthday_month' then
    v_issued_reason := 'birthday_auto';
  elsif v_rule.trigger_type = 'new_registration' then
    v_issued_reason := 'registration_auto';
  else
    v_issued_reason := 'rule_auto';
  end if;

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
    v_rule.template_id,
    v_rule.id,
    null,
    v_issued_reason,
    0,
    v_expires_at,
    jsonb_build_object(
      'cycle_key', p_cycle_key,
      'trigger_type', v_rule.trigger_type,
      'issued_at_engine', p_now
    )
  )
  returning id into v_coupon_id;

  return jsonb_build_object('ok', true, 'issued', true, 'coupon_id', v_coupon_id);
end;
$$;

drop function if exists public.official_run_coupon_auto_issuance_for_user(uuid, timestamptz);

create function public.official_run_coupon_auto_issuance_for_user(
  p_target_user_id uuid default auth.uid(),
  p_now timestamptz default now(),
  p_rule_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_rule record;
  v_window_start date;
  v_window_end date;
  v_grace_days integer;
  v_cycle_key text;
  v_result jsonb;
  v_issued_count integer := 0;
begin
  if p_target_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'missing_user');
  end if;

  if auth.uid() is not null and auth.uid() <> p_target_user_id and not public.official_is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  select id, created_at, birth_date, membership_tier
  into v_profile
  from public.official_profiles
  where id = p_target_user_id
  limit 1;

  if v_profile.id is null then
    return jsonb_build_object('ok', false, 'reason', 'profile_not_found');
  end if;

  for v_rule in
    select *
    from public.official_coupon_issuance_rules
    where status = 'enabled'
      and trigger_type in ('birthday_month', 'new_registration', 'calendar_window')
      and (p_rule_id is null or id = p_rule_id)
  loop
    v_cycle_key := null;

    if v_rule.trigger_type = 'birthday_month' then
      if v_profile.birth_date is not null and extract(month from v_profile.birth_date) = extract(month from p_now) then
        v_cycle_key := format('birthday:%s:%s', v_rule.id, extract(year from p_now)::int);
      end if;
    elsif v_rule.trigger_type = 'new_registration' then
      v_grace_days := greatest(coalesce((v_rule.trigger_config ->> 'grace_days')::integer, 30), 1);
      if v_profile.created_at >= (p_now - make_interval(days => v_grace_days)) then
        v_cycle_key := format('registration:%s:%s', v_rule.id, p_target_user_id);
      end if;
    elsif v_rule.trigger_type = 'calendar_window' then
      begin
        v_window_start := nullif(v_rule.trigger_config ->> 'window_start', '')::date;
        v_window_end := nullif(v_rule.trigger_config ->> 'window_end', '')::date;
      exception
        when others then
          v_window_start := null;
          v_window_end := null;
      end;
      if v_window_start is not null and v_window_end is not null and p_now::date between v_window_start and v_window_end then
        v_cycle_key := format('calendar:%s:%s:%s', v_rule.id, v_window_start, v_window_end);
      end if;
    end if;

    if v_cycle_key is not null then
      v_result := public.official_issue_coupon_by_rule_for_user(v_rule.id, p_target_user_id, v_cycle_key, p_now);
      if coalesce((v_result ->> 'issued')::boolean, false) then
        v_issued_count := v_issued_count + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('ok', true, 'issued_count', v_issued_count, 'user_id', p_target_user_id);
end;
$$;

create or replace function public.official_run_coupon_auto_issuance(
  p_now timestamptz default now(),
  p_rule_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_total_users integer := 0;
  v_total_issued integer := 0;
  v_result jsonb;
  v_service_role boolean := coalesce(current_setting('request.jwt.claim.role', true), '') = 'service_role';
begin
  if not v_service_role and not public.official_is_admin() then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  for v_profile in
    select id
    from public.official_profiles
    where role = 'customer'
  loop
    v_result := public.official_run_coupon_auto_issuance_for_user(v_profile.id, p_now, p_rule_id);
    v_total_users := v_total_users + 1;
    v_total_issued := v_total_issued + coalesce((v_result ->> 'issued_count')::integer, 0);
  end loop;

  return jsonb_build_object('ok', true, 'processed_users', v_total_users, 'issued_count', v_total_issued, 'rule_id', p_rule_id);
end;
$$;

grant execute on function public.official_run_coupon_auto_issuance_for_user(uuid, timestamptz, uuid) to authenticated;
grant execute on function public.official_run_coupon_auto_issuance(timestamptz, uuid) to authenticated;
