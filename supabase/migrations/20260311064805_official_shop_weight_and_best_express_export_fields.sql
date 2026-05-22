alter table public.official_soup_pack_variants
add column if not exists weight_kg numeric(10,3) not null default 0;

alter table public.official_orders
add column if not exists ship_full_name text,
add column if not exists ship_phone text,
add column if not exists ship_postcode text,
add column if not exists ship_address text;
