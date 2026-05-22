create or replace function public.official_admin_reports_dashboard(
  p_start timestamptz,
  p_end timestamptz,
  p_granularity text default 'day'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_granularity text := lower(coalesce(p_granularity, 'day'));
begin
  if not public.official_is_admin() then
    raise exception 'forbidden';
  end if;

  if v_granularity not in ('day', 'week', 'month') then
    v_granularity := 'day';
  end if;

  with ranged_orders as (
    select
      o.id,
      o.user_id,
      o.channel,
      o.currency,
      o.total,
      o.outlet_id,
      o.ship_address,
      o.created_at
    from public.official_orders o
    where o.created_at >= p_start
      and o.created_at <= p_end
  ),
  shop_orders as (
    select * from ranged_orders where channel = 'shop'
  ),
  delivery_orders as (
    select * from ranged_orders where channel = 'delivery'
  ),
  shop_region_orders as (
    select
      case
        when ship_address is null or trim(ship_address) = '' then '未填写'
        when position('|' in ship_address) > 0 then
          coalesce(
            nullif(trim(split_part(ship_address, '|', 4)), ''),
            nullif(trim(split_part(ship_address, '|', 5)), ''),
            '未填写'
          )
        when lower(trim(reverse(split_part(reverse(ship_address), ',', 1)))) in ('malaysia', 'singapore', 'china', 'my', 'sg', 'cn', '马来西亚', '新加坡', '中国') then
          coalesce(
            nullif(trim(reverse(split_part(reverse(ship_address), ',', 2))), ''),
            nullif(trim(reverse(split_part(reverse(ship_address), ',', 1))), ''),
            '未填写'
          )
        else
          coalesce(
            nullif(trim(reverse(split_part(reverse(ship_address), ',', 1))), ''),
            '未填写'
          )
      end as region,
      coalesce(total, 0)::numeric as total
    from shop_orders
  ),
  shop_trend as (
    select
      date_trunc(v_granularity, created_at) as bucket,
      sum(coalesce(total, 0))::numeric as value
    from shop_orders
    group by 1
  ),
  shop_currency_mix as (
    select
      coalesce(currency, 'UNKNOWN') as label,
      sum(coalesce(total, 0))::numeric as value
    from shop_orders
    group by 1
  ),
  shop_region_sales as (
    select
      region as label,
      sum(total)::numeric as value
    from shop_region_orders
    group by 1
    order by value desc, label asc
    limit 6
  ),
  shop_top_products as (
    select
      coalesce(nullif(trim(oi.title), ''), left(oi.item_id, 8)) as label,
      sum(coalesce(oi.quantity, 0))::numeric as value
    from public.official_order_items oi
    join shop_orders so on so.id = oi.order_id
    group by 1
    order by value desc, label asc
    limit 6
  ),
  delivery_trend as (
    select
      date_trunc(v_granularity, created_at) as bucket,
      sum(coalesce(total, 0))::numeric as value
    from delivery_orders
    group by 1
  ),
  delivery_daypart_mix as (
    select
      case
        when extract(hour from created_at) < 11 then '午餐前'
        when extract(hour from created_at) < 15 then '午餐'
        when extract(hour from created_at) < 18 then '下午'
        when extract(hour from created_at) < 22 then '晚餐'
        else '深夜'
      end as label,
      count(*)::numeric as value
    from delivery_orders
    group by 1
  ),
  delivery_outlet_performance as (
    select
      coalesce(nullif(trim(oo.name), ''), doo.outlet_id::text, '未知分店') as label,
      sum(coalesce(doo.total, 0))::numeric as value,
      count(*)::int as order_count
    from delivery_orders doo
    left join public.official_outlets oo on oo.id = doo.outlet_id
    group by 1
    order by value desc, label asc
    limit 6
  ),
  delivery_category_mix as (
    select
      coalesce(nullif(trim(omc.name), ''), '未分类') as label,
      sum(coalesce(oi.quantity, 0))::numeric as value
    from delivery_orders doo
    join public.official_order_items oi
      on oi.order_id = doo.id
     and oi.item_type = 'menu_item'
    left join public.official_menu_items omi on omi.id::text = oi.item_id
    left join public.official_menu_categories omc on omc.id = omi.category_id
    group by 1
    order by value desc, label asc
    limit 5
  ),
  member_activity_events as (
    select
      ro.user_id as member_id,
      ro.created_at as event_at
    from ranged_orders ro
    where ro.user_id is not null
    union all
    select
      acc.member_user_id as member_id,
      acc.submitted_at as event_at
    from public.official_member_rewards_accruals acc
    where acc.submitted_at >= p_start
      and acc.submitted_at <= p_end
  ),
  member_activity_trend as (
    select
      date_trunc(v_granularity, event_at) as bucket,
      count(distinct member_id)::numeric as value
    from member_activity_events
    group by 1
  ),
  member_spend_mix as (
    select '线上消费'::text as label, coalesce(sum(coalesce(total, 0)), 0)::numeric as value
    from ranged_orders
    where user_id is not null
    union all
    select '门店消费'::text as label, coalesce(sum(coalesce(spend_amount, 0)), 0)::numeric as value
    from public.official_member_rewards_accruals
    where submitted_at >= p_start
      and submitted_at <= p_end
      and status = 'approved'
  ),
  member_spender_base as (
    select
      m.member_id,
      sum(m.total_spend)::numeric as total_spend
    from (
      select ro.user_id as member_id, sum(coalesce(ro.total, 0))::numeric as total_spend
      from ranged_orders ro
      where ro.user_id is not null
      group by ro.user_id
      union all
      select acc.member_user_id as member_id, sum(coalesce(acc.spend_amount, 0))::numeric as total_spend
      from public.official_member_rewards_accruals acc
      where acc.submitted_at >= p_start
        and acc.submitted_at <= p_end
        and acc.status = 'approved'
      group by acc.member_user_id
    ) m
    group by m.member_id
  ),
  member_top_spenders as (
    select
      coalesce(nullif(trim(op.full_name), ''), '未命名会员') as label,
      msb.total_spend as value,
      coalesce(nullif(trim(op.phone), ''), '-') as note
    from member_spender_base msb
    left join public.official_profiles op on op.id = msb.member_id
    order by msb.total_spend desc, label asc
    limit 10
  ),
  active_members as (
    select
      coalesce(omo.user_id, mra.member_user_id) as member_id,
      coalesce(omo.shop_orders, 0) as shop_orders,
      coalesce(omo.delivery_orders, 0) as delivery_orders,
      coalesce(mra.dine_in_scans, 0) as dine_in_scans
    from (
      select
        user_id,
        sum(case when channel = 'shop' then 1 else 0 end)::int as shop_orders,
        sum(case when channel = 'delivery' then 1 else 0 end)::int as delivery_orders
      from ranged_orders
      where user_id is not null
      group by user_id
    ) omo
    full outer join (
      select
        member_user_id,
        count(*)::int as dine_in_scans
      from public.official_member_rewards_accruals
      where submitted_at >= p_start
        and submitted_at <= p_end
      group by member_user_id
    ) mra
      on mra.member_user_id = omo.user_id
  ),
  member_tier_distribution as (
    select
      coalesce(op.membership_tier, 'none') as label,
      count(*)::numeric as value
    from active_members am
    left join public.official_profiles op on op.id = am.member_id
    group by 1
    order by value desc, label asc
  ),
  member_channel_preference as (
    select '商城'::text as label, count(*)::numeric as value
    from active_members
    where shop_orders > 0
    union all
    select '外卖'::text as label, count(*)::numeric as value
    from active_members
    where delivery_orders > 0
    union all
    select '门店扫码'::text as label, count(*)::numeric as value
    from active_members
    where dine_in_scans > 0
  ),
  member_outlet_visits as (
    select
      coalesce(nullif(trim(oo.name), ''), '未知门店') as label,
      count(*)::numeric as value
    from public.official_member_rewards_accruals acc
    left join public.official_outlets oo on oo.id = acc.outlet_id
    where acc.submitted_at >= p_start
      and acc.submitted_at <= p_end
    group by 1
    order by value desc, label asc
    limit 10
  )
  select jsonb_build_object(
    'shop', jsonb_build_object(
      'trend', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'label',
            case
              when v_granularity = 'month' then to_char(bucket, 'YYYY-MM')
              when v_granularity = 'week' then '周 ' || to_char(bucket, 'MM/DD')
              else to_char(bucket, 'MM/DD')
            end,
            'sort_key',
            to_char(bucket, 'YYYY-MM-DD'),
            'value',
            value
          )
          order by bucket
        )
        from shop_trend
      ), '[]'::jsonb),
      'currency_mix', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc, label asc)
        from shop_currency_mix
      ), '[]'::jsonb),
      'region_sales', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc, label asc)
        from shop_region_sales
      ), '[]'::jsonb),
      'top_products', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc, label asc)
        from shop_top_products
      ), '[]'::jsonb)
    ),
    'delivery', jsonb_build_object(
      'trend', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'label',
            case
              when v_granularity = 'month' then to_char(bucket, 'YYYY-MM')
              when v_granularity = 'week' then '周 ' || to_char(bucket, 'MM/DD')
              else to_char(bucket, 'MM/DD')
            end,
            'sort_key',
            to_char(bucket, 'YYYY-MM-DD'),
            'value',
            value
          )
          order by bucket
        )
        from delivery_trend
      ), '[]'::jsonb),
      'daypart_mix', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc, label asc)
        from delivery_daypart_mix
      ), '[]'::jsonb),
      'outlet_performance', coalesce((
        select jsonb_agg(
          jsonb_build_object('label', label, 'value', value, 'note', order_count::text || ' 单')
          order by value desc, label asc
        )
        from delivery_outlet_performance
      ), '[]'::jsonb),
      'category_mix', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc, label asc)
        from delivery_category_mix
      ), '[]'::jsonb)
    ),
    'member', jsonb_build_object(
      'activity_trend', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'label',
            case
              when v_granularity = 'month' then to_char(bucket, 'YYYY-MM')
              when v_granularity = 'week' then '周 ' || to_char(bucket, 'MM/DD')
              else to_char(bucket, 'MM/DD')
            end,
            'sort_key',
            to_char(bucket, 'YYYY-MM-DD'),
            'value',
            value
          )
          order by bucket
        )
        from member_activity_trend
      ), '[]'::jsonb),
      'spend_mix', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by label asc)
        from member_spend_mix
      ), '[]'::jsonb),
      'top_spenders', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'value', value, 'note', note) order by value desc, label asc)
        from member_top_spenders
      ), '[]'::jsonb),
      'tier_distribution', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc, label asc)
        from member_tier_distribution
      ), '[]'::jsonb),
      'channel_preference', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by label asc)
        from member_channel_preference
      ), '[]'::jsonb),
      'outlet_visits', coalesce((
        select jsonb_agg(jsonb_build_object('label', label, 'value', value) order by value desc, label asc)
        from member_outlet_visits
      ), '[]'::jsonb)
    )
  )
  into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;
