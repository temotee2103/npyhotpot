create table if not exists public.official_invoice_counters (
  year integer primary key,
  last_number integer not null default 0
);

create or replace function public.official_next_invoice_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::int;
  v_next integer;
begin
  insert into public.official_invoice_counters (year, last_number)
  values (v_year, 1)
  on conflict (year) do update
  set last_number = official_invoice_counters.last_number + 1
  returning last_number into v_next;

  return 'INV-' || v_year::text || '-' || lpad(v_next::text, 6, '0');
end;
$$;

create table if not exists public.official_invoices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.official_orders(id) on delete cascade,
  invoice_no text not null unique,
  currency text not null,
  subtotal numeric(10,2) not null default 0,
  shipping_fee numeric(10,2) not null default 0,
  discount_total numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  pdf_bucket text not null,
  pdf_path text not null,
  pdf_sha256 text,
  pdf_size_bytes integer,
  created_by uuid,
  created_at timestamptz not null default now()
);

create unique index if not exists uq_official_invoices_order_id
on public.official_invoices(order_id);

create table if not exists public.official_invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.official_invoices(id) on delete cascade,
  title text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null default 0,
  line_total numeric(10,2) not null default 0
);

create index if not exists idx_official_invoice_items_invoice_id
on public.official_invoice_items(invoice_id);

alter table public.official_invoices enable row level security;
alter table public.official_invoice_items enable row level security;

drop policy if exists "official_invoices_owner_read" on public.official_invoices;
create policy "official_invoices_owner_read"
on public.official_invoices
for select
using (
  exists(
    select 1
    from public.official_orders o
    where o.id = official_invoices.order_id
      and (o.user_id = auth.uid() or public.official_is_admin())
  )
);

drop policy if exists "official_invoices_admin_write" on public.official_invoices;
create policy "official_invoices_admin_write"
on public.official_invoices
for all
using (public.official_is_admin())
with check (public.official_is_admin());

drop policy if exists "official_invoice_items_owner_read" on public.official_invoice_items;
create policy "official_invoice_items_owner_read"
on public.official_invoice_items
for select
using (
  exists(
    select 1
    from public.official_invoices i
    join public.official_orders o on o.id = i.order_id
    where i.id = official_invoice_items.invoice_id
      and (o.user_id = auth.uid() or public.official_is_admin())
  )
);

drop policy if exists "official_invoice_items_admin_write" on public.official_invoice_items;
create policy "official_invoice_items_admin_write"
on public.official_invoice_items
for all
using (public.official_is_admin())
with check (public.official_is_admin());
