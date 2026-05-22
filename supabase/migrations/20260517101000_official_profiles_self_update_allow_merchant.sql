drop policy if exists "official_profiles_self_update_customer_only" on public.official_profiles;

create policy "official_profiles_self_update_customer_or_merchant"
on public.official_profiles
for update
using (auth.uid() = id)
with check (
  auth.uid() = id
  and role in ('customer','merchant')
  and status <> 'disabled'
);

