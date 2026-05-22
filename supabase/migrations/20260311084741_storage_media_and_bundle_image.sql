-- Create public storage bucket 'media' for product & bundle images
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media_public_read" on storage.objects;
drop policy if exists "media_public_insert" on storage.objects;
drop policy if exists "media_public_update" on storage.objects;

create policy "media_public_read"
on storage.objects for select
using (bucket_id = 'media');

create policy "media_public_insert"
on storage.objects for insert
with check (bucket_id = 'media');

create policy "media_public_update"
on storage.objects for update
with check (bucket_id = 'media');

-- Bundle image_url column
alter table public.official_soup_pack_bundles
add column if not exists image_url text;
