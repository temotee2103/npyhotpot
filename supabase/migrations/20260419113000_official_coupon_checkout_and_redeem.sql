create or replace function public.official_generate_user_coupon_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate text;
begin
  loop
    v_candidate := 'CPN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    exit when not exists (
      select 1
      from public.official_user_coupons
      where coupon_instance_code = v_candidate
    );
  end loop;

  return v_candidate;
end;
$$;

alter table public.official_coupon_templates
add column if not exists applies_channels text[] not null default '{shop,delivery,dine_in}'::text[];

update public.official_coupon_templates
set applies_channels = '{shop,delivery,dine_in}'::text[]
where applies_channels is null
   or coalesce(array_length(applies_channels, 1), 0) = 0;

create index if not exists idx_official_coupon_templates_applies_channels
on public.official_coupon_templates
using gin (applies_channels);

alter table public.official_user_coupons
add column if not exists coupon_instance_code text;

alter table public.official_user_coupons
add column if not exists reserved_order_id uuid references public.official_orders(id) on delete set null;

alter table public.official_user_coupons
add column if not exists reserved_at timestamptz;

alter table public.official_user_coupons
add column if not exists redeemed_channel text;

alter table public.official_user_coupons
add column if not exists redeemed_order_id uuid references public.official_orders(id) on delete set null;

alter table public.official_user_coupons
add column if not exists redeemed_by uuid references public.official_profiles(id) on delete set null;

alter table public.official_user_coupons
add column if not exists redeemed_outlet_id uuid references public.official_outlets(id) on delete set null;

update public.official_user_coupons
set coupon_instance_code = 'CPN-' || upper(substr(replace(id::text, '-', ''), 1, 12))
where coupon_instance_code is null
   or trim(coupon_instance_code) = '';

alter table public.official_user_coupons
alter column coupon_instance_code set default public.official_generate_user_coupon_code();

alter table public.official_user_coupons
alter column coupon_instance_code set not null;

create unique index if not exists idx_official_user_coupons_coupon_instance_code
on public.official_user_coupons (coupon_instance_code);

alter table public.official_user_coupons
drop constraint if exists official_user_coupons_redeemed_channel_check;

alter table public.official_user_coupons
add constraint official_user_coupons_redeemed_channel_check
check (redeemed_channel in ('shop', 'delivery', 'dine_in') or redeemed_channel is null);

create index if not exists idx_official_user_coupons_reserved_order_id
on public.official_user_coupons (reserved_order_id);

create index if not exists idx_official_user_coupons_redeemed_order_id
on public.official_user_coupons (redeemed_order_id);

alter table public.official_orders
add column if not exists user_coupon_id uuid references public.official_user_coupons(id) on delete set null;

create index if not exists idx_official_orders_user_coupon_id
on public.official_orders (user_coupon_id);
