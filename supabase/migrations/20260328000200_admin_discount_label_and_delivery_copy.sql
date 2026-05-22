update public.official_admin_ui
set payload = $$[
  {"title":"总览","links":[{"label":"运营概览","href":"/admin","icon":"dashboard"}]},
  {"title":"在线商城","links":[
    {"label":"商城总览","href":"/admin/shop","icon":"storefront"},
    {"label":"商品管理","href":"/admin/shop/products","icon":"inventory_2"},
    {"label":"Bundle Set","href":"/admin/shop/bundles","icon":"deployed_code"},
    {"label":"优惠券","href":"/admin/shop/discounts","icon":"percent"},
    {"label":"促销活动","href":"/admin/shop/promotions","icon":"local_offer"},
    {"label":"商城订单","href":"/admin/shop/orders","icon":"receipt_long"}
  ]},
  {"title":"外卖配送","links":[
    {"label":"菜单总览","href":"/admin/delivery","icon":"restaurant_menu"},
    {"label":"单品管理","href":"/admin/delivery/menu/items","icon":"list_alt"},
    {"label":"套餐管理","href":"/admin/delivery/menu/combos","icon":"inventory_2"},
    {"label":"规格组","href":"/admin/delivery/menu/option-groups","icon":"tune"},
    {"label":"类目管理","href":"/admin/delivery/menu/categories","icon":"category"},
    {"label":"优惠券","href":"/admin/delivery/discounts","icon":"percent"},
    {"label":"促销活动","href":"/admin/delivery/promotions","icon":"local_offer"},
    {"label":"配送监控","href":"/admin/delivery/dispatch","icon":"local_shipping"}
  ]},
  {"title":"平台运营","links":[
    {"label":"用户管理","href":"/admin/users","icon":"group"},
    {"label":"报表中心","href":"/admin/reports","icon":"bar_chart"}
  ]}
]$$::jsonb
where key = 'admin_nav_groups';

update public.official_admin_ui
set payload = $$[
  {"title":"商品管理","href":"/admin/shop/products","icon":"inventory_2","desc":"单品多币种定价、库存、上下架"},
  {"title":"Bundle Set","href":"/admin/shop/bundles","icon":"deployed_code","desc":"买五送一/自选组合/手动定价"},
  {"title":"优惠券","href":"/admin/shop/discounts","icon":"percent","desc":"优惠券与手工输入折扣策略"},
  {"title":"订单履约","href":"/admin/shop/orders","icon":"receipt_long","desc":"订单详情、邮寄费、发票收据下载"}
]$$::jsonb
where key = 'admin_shop_module_cards';

update public.official_admin_ui
set payload = $$[
  {"title":"类目管理","href":"/admin/delivery/menu/categories","icon":"category","desc":"类目排序、状态、营业时段"},
  {"title":"套餐管理","href":"/admin/delivery/menu/combos","icon":"inventory_2","desc":"套餐组件、必选/可选加购"},
  {"title":"规格组","href":"/admin/delivery/menu/option-groups","icon":"tune","desc":"规格组、加料组、选项加价"},
  {"title":"优惠券","href":"/admin/delivery/discounts","icon":"percent","desc":"优惠券与手工输入折扣策略"}
]$$::jsonb
where key = 'admin_delivery_module_cards';

