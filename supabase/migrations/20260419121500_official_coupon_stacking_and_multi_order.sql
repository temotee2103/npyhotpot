alter table public.official_coupon_templates
add column if not exists stackable boolean not null default false;

alter table public.official_orders
add column if not exists user_coupon_ids uuid[] not null default '{}'::uuid[];

alter table public.official_orders
add column if not exists coupon_codes text[] not null default '{}'::text[];

update public.official_orders
set user_coupon_ids = case
  when user_coupon_id is not null then array[user_coupon_id]
  else '{}'::uuid[]
end
where coalesce(array_length(user_coupon_ids, 1), 0) = 0;

update public.official_orders
set coupon_codes = case
  when coupon_code is not null and trim(coupon_code) <> '' then array[coupon_code]
  else '{}'::text[]
end
where coalesce(array_length(coupon_codes, 1), 0) = 0;

create index if not exists idx_official_coupon_templates_stackable
on public.official_coupon_templates (stackable);
