create table if not exists public.official_payment_contexts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.official_orders(id) on delete cascade,
  channel text not null check (channel in ('shop', 'delivery')),
  context jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (order_id)
);

alter table public.official_payment_contexts enable row level security;

drop policy if exists "official_payment_contexts_admin_read" on public.official_payment_contexts;
drop policy if exists "official_payment_contexts_admin_write" on public.official_payment_contexts;

create policy "official_payment_contexts_admin_read" on public.official_payment_contexts
for select using (public.official_is_admin());

create policy "official_payment_contexts_admin_write" on public.official_payment_contexts
for all using (public.official_is_admin()) with check (public.official_is_admin());

