alter table public.official_profiles
drop constraint if exists official_profiles_role_check;

alter table public.official_profiles
add constraint official_profiles_role_check
check (role in ('customer', 'merchant', 'admin', 'super_admin'));

