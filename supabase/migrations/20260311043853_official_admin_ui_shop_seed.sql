insert into public.official_admin_ui (key, payload)
values
  (
    'admin_shop_module_cards',
    $$[
      {"title":"商品管理","href":"/admin/shop/products","icon":"inventory_2","desc":"单品多币种定价、库存、上下架"},
      {"title":"Bundle Set","href":"/admin/shop/bundles","icon":"deployed_code","desc":"买五送一/自选组合/手动定价"},
      {"title":"Discount","href":"/admin/shop/discounts","icon":"percent","desc":"优惠券与手工输入折扣策略"},
      {"title":"订单履约","href":"/admin/shop/orders","icon":"receipt_long","desc":"订单详情、邮寄费、发票收据下载"}
    ]$$::jsonb
  )
on conflict (key) do update
set
  payload = excluded.payload,
  updated_at = now();
