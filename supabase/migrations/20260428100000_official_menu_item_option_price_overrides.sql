create table if not exists public.official_menu_item_option_price_overrides (
  item_id uuid not null references public.official_menu_items(id) on delete cascade,
  group_id uuid not null references public.official_menu_option_groups(id) on delete cascade,
  option_id uuid not null references public.official_menu_option_options(id) on delete cascade,
  price_delta numeric(10,2) not null default 0,
  primary key (item_id, group_id, option_id)
);

create index if not exists official_menu_item_option_price_overrides_item_idx
  on public.official_menu_item_option_price_overrides(item_id);

alter table public.official_menu_item_option_price_overrides enable row level security;

drop policy if exists "official_menu_item_option_price_overrides_public_read" on public.official_menu_item_option_price_overrides;
drop policy if exists "official_menu_item_option_price_overrides_admin_write" on public.official_menu_item_option_price_overrides;

create policy "official_menu_item_option_price_overrides_public_read"
on public.official_menu_item_option_price_overrides
for select
using (true);

create policy "official_menu_item_option_price_overrides_admin_write"
on public.official_menu_item_option_price_overrides
for all
using (public.official_is_admin())
with check (public.official_is_admin());
