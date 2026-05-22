update public.official_admin_ui
set payload = $$[
  {"title":"总览","links":[{"label":"运营概览","href":"/admin","icon":"dashboard"}]},
  {"title":"在线商城","links":[
    {"label":"商城总览","href":"/admin/shop","icon":"storefront"},
    {"label":"商品管理","href":"/admin/shop/products","icon":"inventory_2"},
    {"label":"Bundle Set","href":"/admin/shop/bundles","icon":"deployed_code"},
    {"label":"Discount","href":"/admin/shop/discounts","icon":"percent"},
    {"label":"促销活动","href":"/admin/shop/promotions","icon":"local_offer"},
    {"label":"商城订单","href":"/admin/shop/orders","icon":"receipt_long"}
  ]},
  {"title":"外卖配送","links":[
    {"label":"菜单总览","href":"/admin/delivery","icon":"restaurant_menu"},
    {"label":"单品管理","href":"/admin/delivery/menu/items","icon":"list_alt"},
    {"label":"套餐管理","href":"/admin/delivery/menu/combos","icon":"inventory_2"},
    {"label":"Option Groups","href":"/admin/delivery/menu/option-groups","icon":"tune"},
    {"label":"类目管理","href":"/admin/delivery/menu/categories","icon":"category"},
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
  {"href":"/admin/shop","icon":"inventory_2","title":"商品管理","desc":"汤包规格、零售商品、库存预警"},
  {"href":"/admin/shop/orders","icon":"shopping_bag","title":"商城订单","desc":"订单履约、打包出库、退款处理"},
  {"href":"/admin/delivery","icon":"menu_book","title":"外卖菜单","desc":"菜单上下架、分类、出餐节奏"},
  {"href":"/admin/delivery/dispatch","icon":"local_shipping","title":"配送监控","desc":"骑手状态、派单、异常预警"},
  {"href":"/admin/shop/promotions","icon":"campaign","title":"商城促销","desc":"活动投放、时间窗、曝光配置"},
  {"href":"/admin/delivery/promotions","icon":"campaign","title":"外卖促销","desc":"活动投放、时间窗、曝光配置"},
  {"href":"/admin/reports","icon":"monitoring","title":"报表中心","desc":"渠道对比、门店表现、趋势分析"}
]$$::jsonb
where key = 'admin_home_quick_links';
