alter table public.official_promotions
add column if not exists image_url text,
add column if not exists video_url text;

