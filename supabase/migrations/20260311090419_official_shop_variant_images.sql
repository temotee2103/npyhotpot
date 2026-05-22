create table if not exists public.official_soup_pack_variant_images (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.official_soup_pack_variants(id) on delete cascade,
  url text not null,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_official_soup_pack_variant_images_variant_id on public.official_soup_pack_variant_images(variant_id);

alter table public.official_soup_pack_variant_images enable row level security;

drop policy if exists "official_soup_pack_variant_images_public_read" on public.official_soup_pack_variant_images;
drop policy if exists "official_soup_pack_variant_images_admin_write" on public.official_soup_pack_variant_images;

create policy "official_soup_pack_variant_images_public_read"
on public.official_soup_pack_variant_images for select
using (
  exists(select 1 from public.official_soup_pack_variants v where v.id = official_soup_pack_variant_images.variant_id and (v.status = 'active' or public.official_is_admin()))
);

create policy "official_soup_pack_variant_images_admin_write"
on public.official_soup_pack_variant_images for all
using (public.official_is_admin())
with check (public.official_is_admin());
