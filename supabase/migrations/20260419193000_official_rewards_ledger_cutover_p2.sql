create or replace function public.official_get_member_points_balance(
  p_user_id uuid
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unified_count integer := 0;
  v_unified_balance numeric := 0;
  v_legacy_balance numeric := 0;
begin
  select count(*), coalesce(sum(points_delta), 0)
  into v_unified_count, v_unified_balance
  from public.official_points_ledger
  where user_id = p_user_id;

  if v_unified_count > 0 then
    return v_unified_balance;
  end if;

  select coalesce(sum(points_delta), 0)
  into v_legacy_balance
  from public.official_member_rewards_points_ledger
  where user_id = p_user_id;

  return v_legacy_balance;
end;
$$;

grant execute on function public.official_get_member_points_balance(uuid) to authenticated;

create or replace function public.official_redeem_points_coupon_template(
  p_template_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_template public.official_coupon_templates%rowtype;
  v_points_balance numeric := 0;
  v_coupon_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  select *
  into v_template
  from public.official_coupon_templates
  where id = p_template_id
    and status = 'enabled'
    and is_points_redeemable = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  limit 1;

  if v_template.id is null then
    return jsonb_build_object('ok', false, 'reason', 'template_not_redeemable');
  end if;

  v_points_balance := public.official_get_member_points_balance(v_user_id);

  if v_points_balance < coalesce(v_template.points_cost, 0) then
    return jsonb_build_object(
      'ok', false,
      'reason', 'insufficient_points',
      'points_balance', v_points_balance,
      'points_cost', coalesce(v_template.points_cost, 0)
    );
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
    v_user_id,
    v_template.id,
    null,
    null,
    'points_redeem',
    coalesce(v_template.points_cost, 0),
    coalesce(v_template.ends_at, now() + interval '30 days'),
    jsonb_build_object('redeemed_via', 'member_coupons_page')
  )
  returning id into v_coupon_id;

  insert into public.official_points_ledger (
    user_id,
    source_type,
    source_id,
    channel,
    event_at,
    points_delta,
    reason,
    meta
  )
  values (
    v_user_id,
    'coupon_redeem',
    v_coupon_id::text,
    'all',
    now(),
    -coalesce(v_template.points_cost, 0),
    'redeem_deduction',
    jsonb_build_object('template_id', v_template.id, 'template_code', v_template.code)
  );

  return jsonb_build_object(
    'ok', true,
    'coupon_id', v_coupon_id,
    'points_cost', coalesce(v_template.points_cost, 0),
    'points_balance_after', v_points_balance - coalesce(v_template.points_cost, 0)
  );
end;
$$;

grant execute on function public.official_redeem_points_coupon_template(uuid) to authenticated;
