alter table public.official_profiles
add column if not exists email text,
add column if not exists avatar_url text;

