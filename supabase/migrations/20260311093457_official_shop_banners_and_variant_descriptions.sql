create table if not exists public.official_shop_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  cta_text text,
  cta_href text,
  sort integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.official_shop_banners enable row level security;

drop policy if exists "official_shop_banners_public_read" on public.official_shop_banners;
drop policy if exists "official_shop_banners_admin_write" on public.official_shop_banners;

create policy "official_shop_banners_public_read"
on public.official_shop_banners for select
using (is_active = true or public.official_is_admin());

create policy "official_shop_banners_admin_write"
on public.official_shop_banners for all
using (public.official_is_admin())
with check (public.official_is_admin());

alter table public.official_soup_pack_variants
add column if not exists usage_text text,
add column if not exists storage_text text,
add column if not exists notice_text text;
