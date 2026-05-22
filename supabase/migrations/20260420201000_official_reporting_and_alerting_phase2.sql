insert into public.official_runtime_settings (key, value)
values
  ('ops_alert_enabled', 'false'),
  ('ops_alert_webhook_url', ''),
  ('ops_alert_channel_name', 'Operations'),
  ('ops_alert_min_severity', 'warning')
on conflict (key) do nothing;

create or replace function public.official_admin_reports_overview(
  p_start timestamptz,
  p_end timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.official_is_admin() then
    raise exception 'forbidden';
  end if;

  with ranged_orders as (
    select
      id,
      user_id,
      channel,
      total,
      created_at
    from public.official_orders
    where created_at >= p_start
      and created_at <= p_end
  ),
  shop_orders as (
    select * from ranged_orders where channel = 'shop'
  ),
  delivery_orders as (
    select * from ranged_orders where channel = 'delivery'
  ),
  shop_user_counts as (
    select user_id, count(*) as order_count
    from shop_orders
    where user_id is not null
    group by user_id
  ),
  delivery_item_rows as (
    select
      oi.order_id,
      sum(coalesce(oi.quantity, 0))::numeric as quantity
    from public.official_order_items oi
    join delivery_orders doo on doo.id = oi.order_id
    where oi.item_type = 'menu_item'
    group by oi.order_id
  ),
  member_dine_in as (
    select
      member_user_id,
      count(*)::int as scans,
      sum(case when status = 'approved' then coalesce(spend_amount, 0) else 0 end)::numeric as approved_spend,
      sum(case when status = 'approved' then 1 else 0 end)::int as approved_count
    from public.official_member_rewards_accruals
    where submitted_at >= p_start
      and submitted_at <= p_end
    group by member_user_id
  ),
  online_member_orders as (
    select
      user_id,
      count(*)::int as online_orders,
      sum(coalesce(total, 0))::numeric as online_spend,
      sum(case when channel = 'shop' then 1 else 0 end)::int as shop_orders,
      sum(case when channel = 'delivery' then 1 else 0 end)::int as delivery_orders
    from ranged_orders
    where user_id is not null
    group by user_id
  ),
  active_members as (
    select
      coalesce(o.user_id, d.member_user_id) as member_id,
      coalesce(o.online_orders, 0) as online_orders,
      coalesce(o.online_spend, 0)::numeric as online_spend,
      coalesce(o.shop_orders, 0) as shop_orders,
      coalesce(o.delivery_orders, 0) as delivery_orders,
      coalesce(d.scans, 0) as dine_in_scans,
      coalesce(d.approved_spend, 0)::numeric as dine_in_spend,
      coalesce(d.approved_count, 0) as dine_in_approved_count
    from online_member_orders o
    full outer join member_dine_in d
      on d.member_user_id = o.user_id
  )
  select jsonb_build_object(
    'shop', jsonb_build_object(
      'order_count', (select count(*) from shop_orders),
      'revenue', coalesce((select sum(coalesce(total, 0)) from shop_orders), 0),
      'average_order_value', coalesce((select avg(coalesce(total, 0)) from shop_orders), 0),
      'member_order_count', (select count(*) from shop_orders where user_id is not null),
      'new_buyer_orders', coalesce((select count(*) from shop_user_counts where order_count = 1), 0),
      'repeat_buyer_orders', coalesce((select sum(order_count) from shop_user_counts where order_count >= 2), 0),
      'repeat_buyer_members', coalesce((select count(*) from shop_user_counts where order_count >= 2), 0)
    ),
    'delivery', jsonb_build_object(
      'order_count', (select count(*) from delivery_orders),
      'revenue', coalesce((select sum(coalesce(total, 0)) from delivery_orders), 0),
      'average_order_value', coalesce((select avg(coalesce(total, 0)) from delivery_orders), 0),
      'sold_pieces', coalesce((select sum(quantity) from delivery_item_rows), 0),
      'average_pieces', coalesce((select avg(quantity) from delivery_item_rows), 0)
    ),
    'member', jsonb_build_object(
      'active_member_count', (select count(*) from active_members),
      'total_spend', coalesce((select sum(online_spend + dine_in_spend) from active_members), 0),
      'online_spend', coalesce((select sum(online_spend) from active_members), 0),
      'dine_in_spend', coalesce((select sum(dine_in_spend) from active_members), 0),
      'dine_in_scans', coalesce((select sum(dine_in_scans) from active_members), 0),
      'repeat_members', coalesce((select count(*) from active_members where online_orders + dine_in_approved_count >= 2), 0)
    )
  )
  into v_result;

  return coalesce(v_result, '{}'::jsonb);
end;
$$;
