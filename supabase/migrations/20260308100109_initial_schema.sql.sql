create extension if not exists pgcrypto;

create table if not exists public.npy_menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  category text not null,
  price_cents integer not null,
  is_available boolean not null default true,
  image_path text,
  tags jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_npy_menu_items_category on public.npy_menu_items (category);

create table if not exists public.npy_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  channel text not null default 'web',
  fulfillment_type text not null check (fulfillment_type in ('dine_in','pickup','delivery')),
  status text not null check (status in ('placed','accepted','cooking','out_for_delivery','completed','cancelled')),
  currency text not null default 'MYR',
  subtotal_cents integer not null default 0,
  delivery_fee_cents integer not null default 0,
  total_cents integer not null default 0,
  contact_name text,
  contact_phone text,
  note text,
  delivery_provider text,
  delivery_status text,
  delivery_tracking_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_npy_orders_user_created on public.npy_orders (user_id, created_at desc);
create index if not exists idx_npy_orders_status_created on public.npy_orders (status, created_at desc);

create table if not exists public.npy_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  menu_item_id uuid not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null,
  options jsonb not null default '{}'::jsonb,
  note text
);

create index if not exists idx_npy_order_items_order_id on public.npy_order_items (order_id);

create table if not exists public.npy_delivery_addresses (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  recipient_name text not null,
  recipient_phone text not null,
  address_line1 text not null,
  address_line2 text,
  city text,
  postal_code text,
  delivery_window text,
  note text
);

create index if not exists idx_npy_delivery_addresses_order_id on public.npy_delivery_addresses (order_id);

create table if not exists public.npy_staff_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  role text not null check (role in ('staff','admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_npy_staff_profiles_user_id on public.npy_staff_profiles (user_id);

create or replace function public.is_staff()
returns boolean
language sql
stable
as $$
  select exists(
    select 1
    from public.npy_staff_profiles sp
    where sp.user_id = auth.uid()
      and sp.is_active = true
  );
$$;

alter table public.npy_menu_items enable row level security;
alter table public.npy_orders enable row level security;
alter table public.npy_order_items enable row level security;
alter table public.npy_delivery_addresses enable row level security;
alter table public.npy_staff_profiles enable row level security;

drop policy if exists menu_items_select_public on public.npy_menu_items;
create policy menu_items_select_public
on public.npy_menu_items
for select
to anon, authenticated
using (is_available = true);

drop policy if exists menu_items_manage_staff on public.npy_menu_items;
create policy menu_items_manage_staff
on public.npy_menu_items
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists orders_insert_owner on public.npy_orders;
create policy orders_insert_owner
on public.npy_orders
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists orders_select_owner on public.npy_orders;
create policy orders_select_owner
on public.npy_orders
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists orders_update_staff on public.npy_orders;
create policy orders_update_staff
on public.npy_orders
for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists orders_select_staff on public.npy_orders;
create policy orders_select_staff
on public.npy_orders
for select
to authenticated
using (public.is_staff());

drop policy if exists order_items_insert_owner on public.npy_order_items;
create policy order_items_insert_owner
on public.npy_order_items
for insert
to authenticated
with check (
  exists(
    select 1
    from public.npy_orders o
    where o.id = npy_order_items.order_id
      and o.user_id = auth.uid()
  )
);

drop policy if exists order_items_select_owner on public.npy_order_items;
create policy order_items_select_owner
on public.npy_order_items
for select
to authenticated
using (
  exists(
    select 1
    from public.npy_orders o
    where o.id = npy_order_items.order_id
      and o.user_id = auth.uid()
  )
);

drop policy if exists order_items_manage_staff on public.npy_order_items;
create policy order_items_manage_staff
on public.npy_order_items
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists delivery_addresses_insert_owner on public.npy_delivery_addresses;
create policy delivery_addresses_insert_owner
on public.npy_delivery_addresses
for insert
to authenticated
with check (
  exists(
    select 1
    from public.npy_orders o
    where o.id = npy_delivery_addresses.order_id
      and o.user_id = auth.uid()
  )
);

drop policy if exists delivery_addresses_select_owner on public.npy_delivery_addresses;
create policy delivery_addresses_select_owner
on public.npy_delivery_addresses
for select
to authenticated
using (
  exists(
    select 1
    from public.npy_orders o
    where o.id = npy_delivery_addresses.order_id
      and o.user_id = auth.uid()
  )
);

drop policy if exists delivery_addresses_manage_staff on public.npy_delivery_addresses;
create policy delivery_addresses_manage_staff
on public.npy_delivery_addresses
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists staff_profiles_select_self on public.npy_staff_profiles;
create policy staff_profiles_select_self
on public.npy_staff_profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists staff_profiles_manage_staff on public.npy_staff_profiles;
create policy staff_profiles_manage_staff
on public.npy_staff_profiles
for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

grant usage on schema public to anon, authenticated;
grant select on public.npy_menu_items to anon;
grant select, insert, update, delete on public.npy_menu_items to authenticated;
grant select, insert, update, delete on public.npy_orders to authenticated;
grant select, insert, update, delete on public.npy_order_items to authenticated;
grant select, insert, update, delete on public.npy_delivery_addresses to authenticated;
grant select, insert, update, delete on public.npy_staff_profiles to authenticated;

insert into public.npy_menu_items (name, description, category, price_cents, is_available, tags)
values
  ('招牌麻辣锅底', '香辣浓郁，回甘不燥', '锅底', 2800, true, '{"spicy": true}'::jsonb),
  ('清汤菌菇锅底', '清爽鲜甜，适合全家', '锅底', 2600, true, '{"spicy": false}'::jsonb),
  ('极品肥牛', '油花细腻，口感嫩滑', '肉类', 3200, true, '{"recommended": true}'::jsonb),
  ('手工虾滑', 'Q弹饱满，鲜味十足', '海鲜', 2400, true, '{"recommended": true}'::jsonb),
  ('综合蔬菜拼盘', '当季新鲜蔬菜', '蔬菜', 1800, true, '{"vegan": true}'::jsonb),
  ('秘制蘸料', '灵魂蘸料，一试难忘', '调料', 600, true, '{"recommended": true}'::jsonb)
on conflict do nothing;
;
