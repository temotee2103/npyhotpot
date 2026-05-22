create unique index if not exists uq_official_profiles_phone
on public.official_profiles (phone)
where phone is not null and length(trim(phone)) > 0;

create unique index if not exists uq_official_profiles_email
on public.official_profiles (email)
where email is not null and length(trim(email)) > 0;

