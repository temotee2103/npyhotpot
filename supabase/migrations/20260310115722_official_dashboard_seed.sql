do $$
begin
  if not exists (select 1 from public.official_outlets) then
    insert into public.official_outlets (id, name, location, operating_hours, is_active)
    values
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Nan Peng You Hotpot SS2', 'Petaling Jaya', '11:00 - 23:00', true),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Nan Peng You Hotpot Sri Petaling', 'Kuala Lumpur', '11:00 - 23:30', true);
  end if;

  if not exists (select 1 from public.official_menu_categories) then
    insert into public.official_menu_categories (id, name, sort, availability, is_active)
    values
      ('11111111-1111-1111-1111-111111111111', '锅底', 1, '10:00 - 23:00', true),
      ('22222222-2222-2222-2222-222222222222', '肉类海鲜', 2, '10:00 - 23:30', true),
      ('33333333-3333-3333-3333-333333333333', '蔬菜豆品', 3, '10:00 - 23:30', true),
      ('44444444-4444-4444-4444-444444444444', '套餐专区', 4, '11:00 - 22:30', true),
      ('55555555-5555-5555-5555-555555555555', '饮品甜品', 5, '12:00 - 22:00', false);
  end if;

  if not exists (select 1 from public.official_menu_option_groups) then
    insert into public.official_menu_option_groups (id, name, required, min_select, max_select, is_active)
    values
      ('66666666-6666-6666-6666-666666666666', '辣度', true, 1, 1, true),
      ('77777777-7777-7777-7777-777777777777', '份量', true, 1, 1, true),
      ('88888888-8888-8888-8888-888888888888', '可选加购', false, 0, 3, true),
      ('99999999-9999-9999-9999-999999999999', '主锅选择', true, 1, 1, true);

    insert into public.official_menu_option_options (group_id, name, price_delta, sort)
    values
      ('66666666-6666-6666-6666-666666666666', '微辣', 0, 1),
      ('66666666-6666-6666-6666-666666666666', '中辣', 0, 2),
      ('66666666-6666-6666-6666-666666666666', '特辣', 0, 3),
      ('77777777-7777-7777-7777-777777777777', '标准', 0, 1),
      ('77777777-7777-7777-7777-777777777777', '加大', 6, 2),
      ('77777777-7777-7777-7777-777777777777', '双份', 18, 3),
      ('88888888-8888-8888-8888-888888888888', '澳洲和牛', 18, 1),
      ('88888888-8888-8888-8888-888888888888', '手打青虾滑', 12, 2),
      ('88888888-8888-8888-8888-888888888888', '手工面', 9, 3),
      ('88888888-8888-8888-8888-888888888888', '米饭', 4, 4),
      ('99999999-9999-9999-9999-999999999999', '麻辣牛油锅', 0, 1),
      ('99999999-9999-9999-9999-999999999999', '番茄浓汤锅', 0, 2),
      ('99999999-9999-9999-9999-999999999999', '花胶汤底', 12, 3);
  end if;

  if not exists (select 1 from public.official_menu_items) then
    insert into public.official_menu_items (id, name, description, category_id, item_type, base_price, tags, is_active)
    values
      ('aaaaaaaa-1111-1111-1111-111111111111', '招牌麻辣牛油锅', '精选川男牛油，搭配香辛料，麻辣浓郁。', '11111111-1111-1111-1111-111111111111', 'ala_carte', 58, array['热销','招牌'], true),
      ('aaaaaaaa-2222-2222-2222-222222222222', '番茄浓汤锅底', '精选大番茄，酸甜开胃。', '11111111-1111-1111-1111-111111111111', 'ala_carte', 48, array['酸甜','家庭推荐'], true),
      ('aaaaaaaa-3333-3333-3333-333333333333', '一号肥牛卷', '肥瘦相间，鲜嫩多汁。', '22222222-2222-2222-2222-222222222222', 'ala_carte', 42, array['搭配推荐'], true),
      ('aaaaaaaa-6666-6666-6666-666666666666', '经典双人锅套餐', '双人套餐组合，含锅底与主菜。', '44444444-4444-4444-4444-444444444444', 'combo', 128, array['套餐','高转化'], true),
      ('aaaaaaaa-7777-7777-7777-777777777777', '家庭四人宴套餐', '四人分享套餐组合。', '44444444-4444-4444-4444-444444444444', 'combo', 268, array['套餐','节假日推荐'], false);

    insert into public.official_menu_item_option_groups (item_id, group_id)
    values
      ('aaaaaaaa-1111-1111-1111-111111111111', '66666666-6666-6666-6666-666666666666'),
      ('aaaaaaaa-1111-1111-1111-111111111111', '77777777-7777-7777-7777-777777777777'),
      ('aaaaaaaa-2222-2222-2222-222222222222', '77777777-7777-7777-7777-777777777777'),
      ('aaaaaaaa-3333-3333-3333-333333333333', '77777777-7777-7777-7777-777777777777'),
      ('aaaaaaaa-6666-6666-6666-666666666666', '99999999-9999-9999-9999-999999999999'),
      ('aaaaaaaa-6666-6666-6666-666666666666', '88888888-8888-8888-8888-888888888888'),
      ('aaaaaaaa-7777-7777-7777-777777777777', '99999999-9999-9999-9999-999999999999'),
      ('aaaaaaaa-7777-7777-7777-777777777777', '88888888-8888-8888-8888-888888888888')
    on conflict do nothing;

    insert into public.official_menu_combo_components (combo_item_id, component_item_id, quantity)
    values
      ('aaaaaaaa-6666-6666-6666-666666666666', 'aaaaaaaa-1111-1111-1111-111111111111', 1),
      ('aaaaaaaa-6666-6666-6666-666666666666', 'aaaaaaaa-3333-3333-3333-333333333333', 1),
      ('aaaaaaaa-7777-7777-7777-777777777777', 'aaaaaaaa-1111-1111-1111-111111111111', 1),
      ('aaaaaaaa-7777-7777-7777-777777777777', 'aaaaaaaa-2222-2222-2222-222222222222', 1),
      ('aaaaaaaa-7777-7777-7777-777777777777', 'aaaaaaaa-3333-3333-3333-333333333333', 1)
    on conflict do nothing;
  end if;

  insert into public.official_dispatch_rules (name, value, detail, is_active, sort)
  values
    ('自动派单开关', '已开启', '支付成功后 5 秒内自动触发派单', true, 1),
    ('最近骑手策略', '已启用', '按距离 + SLA 评分自动选择承运骑手', true, 2),
    ('失败重试', '2 次', '第一次失败 30 秒后自动重试，再失败转人工', true, 3)
  on conflict (name) do update
  set value = excluded.value, detail = excluded.detail, is_active = excluded.is_active, sort = excluded.sort;

  if not exists (select 1 from public.official_promotions) then
    insert into public.official_promotions (title, channel, schedule_kind, starts_at, ends_at, daily_start, daily_end, weekly_days, status)
    values
      ('商城满 RM199 免运', 'shop', 'range', now() - interval '2 day', now() + interval '19 day', null, null, '{}'::int[], 'active'),
      ('外卖晚高峰满减', 'delivery', 'daily_window', null, null, '17:00', '21:00', '{}'::int[], 'active'),
      ('新品汤包首单立减', 'shop', 'range', now() + interval '2 day', now() + interval '22 day', null, null, '{}'::int[], 'scheduled'),
      ('周末外卖双倍积分', 'delivery', 'weekly', null, null, null, null, array[6,0], 'draft');
  end if;

  if not exists (select 1 from public.official_orders) then
    insert into public.official_orders (id, user_id, outlet_id, channel, currency, status, subtotal, shipping_fee, discount_total, total, coupon_code, created_at)
    values
      ('c1111111-1111-1111-1111-111111111111', null, null, 'shop', 'MYR', 'pending', 256, 12, 10, 258, 'NEW10', now() - interval '45 minute'),
      ('c2222222-2222-2222-2222-222222222222', null, null, 'shop', 'SGD', 'pending', 62, 6, 3, 65, null, now() - interval '90 minute'),
      ('c3333333-3333-3333-3333-333333333333', null, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'delivery', 'MYR', 'pending', 96, 5, 0, 101, null, now() - interval '35 minute'),
      ('c4444444-4444-4444-4444-444444444444', null, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'delivery', 'MYR', 'pending', 142, 5, 0, 147, null, now() - interval '70 minute');

    insert into public.official_order_items (order_id, item_type, item_id, title, quantity, unit_price)
    select
      'c1111111-1111-1111-1111-111111111111',
      'soup_pack_variant',
      v.id,
      v.title,
      x.qty,
      x.unit_price
    from (values
      ('SP-001', 1, 168::numeric),
      ('SP-002', 1, 88::numeric)
    ) as x(sku, qty, unit_price)
    join public.official_soup_pack_variants v on v.sku = x.sku;

    insert into public.official_order_items (order_id, item_type, item_id, title, quantity, unit_price)
    select
      'c2222222-2222-2222-2222-222222222222',
      'soup_pack_variant',
      v.id,
      v.title,
      x.qty,
      x.unit_price
    from (values
      ('SP-002', 2, 31::numeric)
    ) as x(sku, qty, unit_price)
    join public.official_soup_pack_variants v on v.sku = x.sku;

    insert into public.official_order_items (order_id, item_type, item_id, title, quantity, unit_price)
    values
      ('c3333333-3333-3333-3333-333333333333', 'menu_item', 'aaaaaaaa-1111-1111-1111-111111111111', '招牌麻辣牛油锅', 1, 58),
      ('c3333333-3333-3333-3333-333333333333', 'menu_item', 'aaaaaaaa-3333-3333-3333-333333333333', '一号肥牛卷', 1, 42),
      ('c4444444-4444-4444-4444-444444444444', 'menu_item', 'aaaaaaaa-6666-6666-6666-666666666666', '经典双人锅套餐', 1, 128),
      ('c4444444-4444-4444-4444-444444444444', 'menu_item', 'aaaaaaaa-3333-3333-3333-333333333333', '一号肥牛卷', 1, 42);

    insert into public.official_payments (order_id, gateway_ref, status, amount, method, provider, created_at)
    values
      ('c1111111-1111-1111-1111-111111111111', 'TX-7841', 'created', 258, 'FPX', 'DemoPay', now() - interval '44 minute'),
      ('c2222222-2222-2222-2222-222222222222', 'TX-7840', 'created', 65, 'Card', 'DemoPay', now() - interval '89 minute'),
      ('c3333333-3333-3333-3333-333333333333', 'TX-7839', 'created', 101, 'Card', 'DemoPay', now() - interval '34 minute'),
      ('c4444444-4444-4444-4444-444444444444', 'TX-7838', 'created', 147, 'eWallet', 'DemoPay', now() - interval '69 minute');

    insert into public.official_deliveries (id, order_id, lalamove_order_id, status, pickup_outlet_id, dropoff_address, created_at)
    values
      ('d1111111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333', 'LM-1032', 'requested', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Bangsar South, Tower B-12-06', now() - interval '33 minute'),
      ('d2222222-2222-2222-2222-222222222222', 'c4444444-4444-4444-4444-444444444444', 'LM-1031', 'requested', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Cheras Traders Square C-18-02', now() - interval '68 minute');

    insert into public.official_delivery_events (delivery_id, step, created_at)
    values
      ('d1111111-1111-1111-1111-111111111111', '支付成功', now() - interval '35 minute'),
      ('d1111111-1111-1111-1111-111111111111', '自动派单成功', now() - interval '34 minute'),
      ('d1111111-1111-1111-1111-111111111111', '骑手取餐', now() - interval '20 minute'),
      ('d1111111-1111-1111-1111-111111111111', '配送中', now() - interval '10 minute'),
      ('d2222222-2222-2222-2222-222222222222', '支付成功', now() - interval '70 minute'),
      ('d2222222-2222-2222-2222-222222222222', '自动派单成功', now() - interval '69 minute'),
      ('d2222222-2222-2222-2222-222222222222', '门店备餐中', now() - interval '50 minute');
  end if;
end $$;
