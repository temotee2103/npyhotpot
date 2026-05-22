alter table public.official_profiles
add column if not exists birth_date date;

create index if not exists idx_official_profiles_birth_date
on public.official_profiles (birth_date);
