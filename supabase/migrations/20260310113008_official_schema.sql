create extension if not exists pgcrypto;

create table if not exists public.official_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  address text,
  role text not null default 'customer' check (role in ('customer', 'admin', 'super_admin')),
  created_at timestamptz not null default now()
);

create or replace function public.official_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.official_profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
  );
$$;

create or replace function public.official_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1
    from public.official_profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  );
$$;

create table if not exists public.official_admin_roles (
  user_id uuid primary key references public.official_profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'super_admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.official_outlets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text not null,
  operating_hours text not null,
  is_active boolean not null default true
);

create table if not exists public.official_menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort integer not null default 0,
  availability text not null default '10:00 - 23:00',
  is_active boolean not null default true
);

create table if not exists public.official_menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category_id uuid references public.official_menu_categories(id),
  item_type text not null check (item_type in ('ala_carte', 'combo')),
  base_price numeric(10,2) not null default 0,
  tags text[] not null default '{}'::text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.official_menu_option_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  required boolean not null default false,
  min_select integer not null default 0,
  max_select integer not null default 1,
  is_active boolean not null default true
);

create table if not exists public.official_menu_option_options (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.official_menu_option_groups(id) on delete cascade,
  name text not null,
  price_delta numeric(10,2) not null default 0,
  sort integer not null default 0
);

create table if not exists public.official_menu_item_option_groups (
  item_id uuid not null references public.official_menu_items(id) on delete cascade,
  group_id uuid not null references public.official_menu_option_groups(id) on delete cascade,
  primary key (item_id, group_id)
);

create table if not exists public.official_menu_combo_components (
  combo_item_id uuid not null references public.official_menu_items(id) on delete cascade,
  component_item_id uuid not null references public.official_menu_items(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  primary key (combo_item_id, component_item_id)
);

create table if not exists public.official_soup_pack_variants (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  title text not null,
  subtitle text,
  stock integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'pending_review', 'active')),
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table if not exists public.official_soup_pack_prices (
  variant_id uuid not null references public.official_soup_pack_variants(id) on delete cascade,
  currency text not null check (currency in ('MYR', 'SGD')),
  price numeric(10,2) not null,
  primary key (variant_id, currency)
);

create table if not exists public.official_soup_pack_bundles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'active')),
  rule_kind text not null check (rule_kind in ('buy_x_get_y', 'fixed_bundle')),
  buy_qty integer,
  free_qty integer,
  pricing_mode text not null default 'auto' check (pricing_mode in ('auto', 'manual')),
  myr_price numeric(10,2),
  sgd_price numeric(10,2),
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now()
);

create table if not exists public.official_soup_pack_bundle_items (
  bundle_id uuid not null references public.official_soup_pack_bundles(id) on delete cascade,
  variant_id uuid not null references public.official_soup_pack_variants(id) on delete cascade,
  quantity integer not null default 1 check (quantity > 0),
  primary key (bundle_id, variant_id)
);

create table if not exists public.official_discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  status text not null default 'enabled' check (status in ('enabled', 'disabled')),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  percent_off numeric(10,2),
  myr_amount_off numeric(10,2),
  sgd_amount_off numeric(10,2),
  myr_min_spend numeric(10,2),
  sgd_min_spend numeric(10,2),
  stackable boolean not null default false,
  valid_from timestamptz,
  valid_to timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.official_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.official_profiles(id),
  channel text not null check (channel in ('shop', 'delivery')),
  currency text not null check (currency in ('MYR', 'SGD')),
  status text not null default 'pending',
  subtotal numeric(10,2) not null default 0,
  shipping_fee numeric(10,2) not null default 0,
  discount_total numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  coupon_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.official_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.official_orders(id) on delete cascade,
  item_type text not null check (item_type in ('soup_pack_variant', 'menu_item', 'bundle')),
  item_id uuid not null,
  title text,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null
);

create table if not exists public.official_order_adjustments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.official_orders(id) on delete cascade,
  adjustment_type text not null check (adjustment_type in ('manual_discount', 'manual_shipping_fee')),
  label text,
  amount numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.official_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.official_orders(id) on delete cascade,
  gateway_ref text,
  status text not null default 'created',
  amount numeric(10,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.official_deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.official_orders(id) on delete cascade,
  lalamove_order_id text,
  status text not null default 'requested',
  pickup_outlet_id uuid references public.official_outlets(id),
  dropoff_address text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.official_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.official_profiles enable row level security;
alter table public.official_orders enable row level security;
alter table public.official_order_items enable row level security;
alter table public.official_order_adjustments enable row level security;
alter table public.official_payments enable row level security;
alter table public.official_deliveries enable row level security;
alter table public.official_discounts enable row level security;
alter table public.official_soup_pack_variants enable row level security;
alter table public.official_soup_pack_prices enable row level security;
alter table public.official_soup_pack_bundles enable row level security;
alter table public.official_soup_pack_bundle_items enable row level security;
alter table public.official_menu_categories enable row level security;
alter table public.official_menu_items enable row level security;
alter table public.official_menu_option_groups enable row level security;
alter table public.official_menu_option_options enable row level security;
alter table public.official_menu_item_option_groups enable row level security;
alter table public.official_menu_combo_components enable row level security;
alter table public.official_outlets enable row level security;
alter table public.official_admin_roles enable row level security;
alter table public.official_audit_logs enable row level security;

drop policy if exists "official_profiles_self_read" on public.official_profiles;
drop policy if exists "official_profiles_self_update" on public.official_profiles;
drop policy if exists "official_profiles_self_insert" on public.official_profiles;
create policy "official_profiles_self_read" on public.official_profiles for select using (auth.uid() = id or public.official_is_admin());
create policy "official_profiles_self_update" on public.official_profiles for update using (auth.uid() = id or public.official_is_admin());
create policy "official_profiles_self_insert" on public.official_profiles for insert with check (auth.uid() = id);

drop policy if exists "official_admin_roles_admin_read" on public.official_admin_roles;
drop policy if exists "official_admin_roles_super_admin_write" on public.official_admin_roles;
create policy "official_admin_roles_admin_read" on public.official_admin_roles for select using (public.official_is_admin());
create policy "official_admin_roles_super_admin_write" on public.official_admin_roles for all using (public.official_is_super_admin()) with check (public.official_is_super_admin());

drop policy if exists "official_orders_owner_read" on public.official_orders;
drop policy if exists "official_orders_owner_insert" on public.official_orders;
drop policy if exists "official_orders_admin_update" on public.official_orders;
create policy "official_orders_owner_read" on public.official_orders for select using (auth.uid() = user_id or public.official_is_admin());
create policy "official_orders_owner_insert" on public.official_orders for insert with check (auth.uid() = user_id);
create policy "official_orders_admin_update" on public.official_orders for update using (public.official_is_admin());

drop policy if exists "official_order_items_owner_read" on public.official_order_items;
drop policy if exists "official_order_items_owner_insert" on public.official_order_items;
drop policy if exists "official_order_items_admin_update" on public.official_order_items;
create policy "official_order_items_owner_read" on public.official_order_items for select using (
  exists(select 1 from public.official_orders o where o.id = official_order_items.order_id and (o.user_id = auth.uid() or public.official_is_admin()))
);
create policy "official_order_items_owner_insert" on public.official_order_items for insert with check (
  exists(select 1 from public.official_orders o where o.id = official_order_items.order_id and o.user_id = auth.uid())
);
create policy "official_order_items_admin_update" on public.official_order_items for update using (public.official_is_admin());

drop policy if exists "official_order_adjustments_admin_all" on public.official_order_adjustments;
create policy "official_order_adjustments_admin_all" on public.official_order_adjustments for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_payments_owner_read" on public.official_payments;
drop policy if exists "official_payments_admin_write" on public.official_payments;
create policy "official_payments_owner_read" on public.official_payments for select using (
  exists(select 1 from public.official_orders o where o.id = official_payments.order_id and (o.user_id = auth.uid() or public.official_is_admin()))
);
create policy "official_payments_admin_write" on public.official_payments for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_deliveries_owner_read" on public.official_deliveries;
drop policy if exists "official_deliveries_admin_write" on public.official_deliveries;
create policy "official_deliveries_owner_read" on public.official_deliveries for select using (
  exists(select 1 from public.official_orders o where o.id = official_deliveries.order_id and (o.user_id = auth.uid() or public.official_is_admin()))
);
create policy "official_deliveries_admin_write" on public.official_deliveries for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_menu_categories_public_read" on public.official_menu_categories;
drop policy if exists "official_menu_categories_admin_write" on public.official_menu_categories;
create policy "official_menu_categories_public_read" on public.official_menu_categories for select using (is_active = true or public.official_is_admin());
create policy "official_menu_categories_admin_write" on public.official_menu_categories for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_menu_items_public_read" on public.official_menu_items;
drop policy if exists "official_menu_items_admin_write" on public.official_menu_items;
create policy "official_menu_items_public_read" on public.official_menu_items for select using (is_active = true or public.official_is_admin());
create policy "official_menu_items_admin_write" on public.official_menu_items for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_menu_option_groups_public_read" on public.official_menu_option_groups;
drop policy if exists "official_menu_option_groups_admin_write" on public.official_menu_option_groups;
create policy "official_menu_option_groups_public_read" on public.official_menu_option_groups for select using (is_active = true or public.official_is_admin());
create policy "official_menu_option_groups_admin_write" on public.official_menu_option_groups for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_menu_option_options_public_read" on public.official_menu_option_options;
drop policy if exists "official_menu_option_options_admin_write" on public.official_menu_option_options;
create policy "official_menu_option_options_public_read" on public.official_menu_option_options for select using (
  exists(select 1 from public.official_menu_option_groups g where g.id = official_menu_option_options.group_id and (g.is_active = true or public.official_is_admin()))
);
create policy "official_menu_option_options_admin_write" on public.official_menu_option_options for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_menu_item_option_groups_public_read" on public.official_menu_item_option_groups;
drop policy if exists "official_menu_item_option_groups_admin_write" on public.official_menu_item_option_groups;
create policy "official_menu_item_option_groups_public_read" on public.official_menu_item_option_groups for select using (true);
create policy "official_menu_item_option_groups_admin_write" on public.official_menu_item_option_groups for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_menu_combo_components_public_read" on public.official_menu_combo_components;
drop policy if exists "official_menu_combo_components_admin_write" on public.official_menu_combo_components;
create policy "official_menu_combo_components_public_read" on public.official_menu_combo_components for select using (true);
create policy "official_menu_combo_components_admin_write" on public.official_menu_combo_components for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_soup_pack_variants_public_read" on public.official_soup_pack_variants;
drop policy if exists "official_soup_pack_variants_admin_write" on public.official_soup_pack_variants;
create policy "official_soup_pack_variants_public_read" on public.official_soup_pack_variants for select using (status = 'active' or public.official_is_admin());
create policy "official_soup_pack_variants_admin_write" on public.official_soup_pack_variants for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_soup_pack_prices_public_read" on public.official_soup_pack_prices;
drop policy if exists "official_soup_pack_prices_admin_write" on public.official_soup_pack_prices;
create policy "official_soup_pack_prices_public_read" on public.official_soup_pack_prices for select using (
  exists(select 1 from public.official_soup_pack_variants v where v.id = official_soup_pack_prices.variant_id and (v.status = 'active' or public.official_is_admin()))
);
create policy "official_soup_pack_prices_admin_write" on public.official_soup_pack_prices for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_soup_pack_bundles_public_read" on public.official_soup_pack_bundles;
drop policy if exists "official_soup_pack_bundles_admin_write" on public.official_soup_pack_bundles;
create policy "official_soup_pack_bundles_public_read" on public.official_soup_pack_bundles for select using (status = 'active' or public.official_is_admin());
create policy "official_soup_pack_bundles_admin_write" on public.official_soup_pack_bundles for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_soup_pack_bundle_items_public_read" on public.official_soup_pack_bundle_items;
drop policy if exists "official_soup_pack_bundle_items_admin_write" on public.official_soup_pack_bundle_items;
create policy "official_soup_pack_bundle_items_public_read" on public.official_soup_pack_bundle_items for select using (
  exists(select 1 from public.official_soup_pack_bundles b where b.id = official_soup_pack_bundle_items.bundle_id and (b.status = 'active' or public.official_is_admin()))
);
create policy "official_soup_pack_bundle_items_admin_write" on public.official_soup_pack_bundle_items for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_discounts_public_read" on public.official_discounts;
drop policy if exists "official_discounts_admin_write" on public.official_discounts;
create policy "official_discounts_public_read" on public.official_discounts for select using (status = 'enabled' or public.official_is_admin());
create policy "official_discounts_admin_write" on public.official_discounts for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_outlets_public_read" on public.official_outlets;
drop policy if exists "official_outlets_admin_write" on public.official_outlets;
create policy "official_outlets_public_read" on public.official_outlets for select using (is_active = true or public.official_is_admin());
create policy "official_outlets_admin_write" on public.official_outlets for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_audit_logs_admin_read" on public.official_audit_logs;
drop policy if exists "official_audit_logs_admin_insert" on public.official_audit_logs;
create policy "official_audit_logs_admin_read" on public.official_audit_logs for select using (public.official_is_admin());
create policy "official_audit_logs_admin_insert" on public.official_audit_logs for insert with check (public.official_is_admin());
