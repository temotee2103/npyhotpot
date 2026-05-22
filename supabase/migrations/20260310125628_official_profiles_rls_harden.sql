drop policy if exists "official_profiles_self_read" on public.official_profiles;
drop policy if exists "official_profiles_self_update" on public.official_profiles;
drop policy if exists "official_profiles_self_insert" on public.official_profiles;

create policy "official_profiles_self_read"
on public.official_profiles
for select
using (auth.uid() = id or public.official_is_admin());

create policy "official_profiles_self_insert_customer_only"
on public.official_profiles
for insert
with check (
  auth.uid() = id
  and role = 'customer'
);

create policy "official_profiles_self_update_customer_only"
on public.official_profiles
for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role = 'customer'
  and status <> 'disabled'
);

create policy "official_profiles_admin_update"
on public.official_profiles
for update
using (public.official_is_admin())
with check (public.official_is_admin());
