drop policy if exists "official_promotions_public_read" on public.official_promotions;

create policy "official_promotions_public_read"
on public.official_promotions for select
using (status = 'active');
