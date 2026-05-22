insert into public.official_soup_pack_variants (sku, title, subtitle, stock, status, tags)
values
  ('SP-001', '男朋友金汤花胶鸡', '胶原满满 · 招牌爆款', 128, 'active', array['招牌','爆款']),
  ('SP-002', '男朋友松茸菌汤包', '鲜美养生 · 清爽回甘', 56, 'active', array['养生']),
  ('SP-003', '男朋友番茄牛腩汤包', '酸甜开胃 · 牛腩大块', 18, 'active', array['新品']),
  ('SP-004', '男朋友椰子鸡汤包', '清甜椰香 · 温润不腻', 0, 'active', array['限定'])
on conflict (sku) do update
set
  title = excluded.title,
  subtitle = excluded.subtitle,
  stock = excluded.stock,
  status = excluded.status,
  tags = excluded.tags;

insert into public.official_soup_pack_prices (variant_id, currency, price)
select v.id, 'MYR', p.price
from public.official_soup_pack_variants v
join (
  values
    ('SP-001', 168::numeric),
    ('SP-002', 88::numeric),
    ('SP-003', 98::numeric),
    ('SP-004', 118::numeric)
) as p(sku, price) on p.sku = v.sku
on conflict (variant_id, currency) do update set price = excluded.price;

insert into public.official_soup_pack_prices (variant_id, currency, price)
select v.id, 'SGD', p.price
from public.official_soup_pack_variants v
join (
  values
    ('SP-001', 58::numeric),
    ('SP-002', 31::numeric),
    ('SP-003', 34::numeric),
    ('SP-004', 41::numeric)
) as p(sku, price) on p.sku = v.sku
on conflict (variant_id, currency) do update set price = excluded.price;

insert into public.official_soup_pack_bundles (code, title, status, rule_kind, buy_qty, free_qty, pricing_mode, tags)
values
  ('B5G1', '买五送一（汤包同款）', 'active', 'buy_x_get_y', 5, 1, 'auto', array['Bundle','高转化']),
  ('CUSTOM6', '6包自选组合（客制化）', 'active', 'fixed_bundle', null, null, 'manual', array['Bundle','客制化'])
on conflict (code) do update
set
  title = excluded.title,
  status = excluded.status,
  rule_kind = excluded.rule_kind,
  buy_qty = excluded.buy_qty,
  free_qty = excluded.free_qty,
  pricing_mode = excluded.pricing_mode,
  tags = excluded.tags;

update public.official_soup_pack_bundles
set myr_price = 468, sgd_price = 162
where code = 'CUSTOM6';

insert into public.official_soup_pack_bundle_items (bundle_id, variant_id, quantity)
select b.id, v.id, x.qty
from public.official_soup_pack_bundles b
join (
  values
    ('CUSTOM6', 'SP-001', 2),
    ('CUSTOM6', 'SP-002', 2),
    ('CUSTOM6', 'SP-003', 2)
) as x(bundle_code, sku, qty) on x.bundle_code = b.code
join public.official_soup_pack_variants v on v.sku = x.sku
on conflict (bundle_id, variant_id) do update set quantity = excluded.quantity;

insert into public.official_discounts (
  code,
  title,
  status,
  discount_type,
  percent_off,
  myr_amount_off,
  sgd_amount_off,
  myr_min_spend,
  sgd_min_spend,
  stackable
)
values
  ('NEW10', '新客 9 折', 'enabled', 'percent', 10, null, null, 80, 28, false),
  ('SHIPFREE', '满额减运费（手动输入）', 'enabled', 'fixed', null, 15, 5, 199, 70, false),
  ('VIP20', 'VIP 立减', 'disabled', 'fixed', null, 20, 7, null, null, true)
on conflict (code) do update
set
  title = excluded.title,
  status = excluded.status,
  discount_type = excluded.discount_type,
  percent_off = excluded.percent_off,
  myr_amount_off = excluded.myr_amount_off,
  sgd_amount_off = excluded.sgd_amount_off,
  myr_min_spend = excluded.myr_min_spend,
  sgd_min_spend = excluded.sgd_min_spend,
  stackable = excluded.stackable;
