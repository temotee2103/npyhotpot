alter table public.official_orders
  add column if not exists paid_at timestamptz,
  add column if not exists settled_at timestamptz,
  add column if not exists active_payment_id uuid;

alter table public.official_payments
  add column if not exists txn_id text,
  add column if not exists is_active boolean not null default false;

update public.official_orders
set status = 'created'
where status is null
  or status not in ('created', 'paid', 'fulfilling', 'completed', 'cancelled', 'payment_failed');

update public.official_payments
set status = 'pending'
where status is null
  or status not in ('created', 'pending', 'succeeded', 'failed', 'superseded');

with latest as (
  select distinct on (order_id) id, order_id
  from public.official_payments
  order by order_id, created_at desc, id desc
)
update public.official_payments p
set is_active = true
from latest
where p.id = latest.id;

with latest as (
  select distinct on (order_id) id, order_id
  from public.official_payments
  order by order_id, created_at desc, id desc
)
update public.official_payments p
set is_active = false
from latest
where p.order_id = latest.order_id
  and p.id <> latest.id
  and p.is_active = true;

with latest as (
  select distinct on (order_id) id, order_id
  from public.official_payments
  order by order_id, created_at desc, id desc
)
update public.official_orders o
set active_payment_id = latest.id
from latest
where o.id = latest.order_id
  and o.active_payment_id is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'official_orders_status_check_v2'
  ) then
    alter table public.official_orders
      add constraint official_orders_status_check_v2
      check (status in ('created', 'paid', 'fulfilling', 'completed', 'cancelled', 'payment_failed'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'official_payments_status_check_v2'
  ) then
    alter table public.official_payments
      add constraint official_payments_status_check_v2
      check (status in ('created', 'pending', 'succeeded', 'failed', 'superseded'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'official_orders_active_payment_fk'
  ) then
    alter table public.official_orders
      add constraint official_orders_active_payment_fk
      foreign key (active_payment_id) references public.official_payments(id);
  end if;
end
$$;
