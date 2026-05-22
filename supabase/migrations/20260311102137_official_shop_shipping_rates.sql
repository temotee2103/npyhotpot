create table if not exists public.official_shop_shipping_rates (
  id uuid primary key default gen_random_uuid(),
  currency text not null check (currency in ('MYR', 'SGD')),
  country text not null check (country in ('MY', 'SG')),
  fee numeric not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (currency, country)
);

alter table public.official_shop_shipping_rates enable row level security;

drop policy if exists "official_shop_shipping_rates_public_read" on public.official_shop_shipping_rates;
drop policy if exists "official_shop_shipping_rates_admin_write" on public.official_shop_shipping_rates;

create policy "official_shop_shipping_rates_public_read"
on public.official_shop_shipping_rates for select
using (is_active = true or public.official_is_admin());

create policy "official_shop_shipping_rates_admin_write"
on public.official_shop_shipping_rates for all
using (public.official_is_admin())
with check (public.official_is_admin());

insert into public.official_shop_shipping_rates (currency, country, fee, is_active)
values
  ('MYR', 'MY', 0, true),
  ('SGD', 'SG', 0, true)
on conflict (currency, country) do nothing;
