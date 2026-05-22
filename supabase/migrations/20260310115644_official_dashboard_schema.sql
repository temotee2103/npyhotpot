alter table public.official_orders
add column if not exists outlet_id uuid references public.official_outlets(id);

alter table public.official_payments
add column if not exists method text,
add column if not exists provider text;

alter table public.official_profiles
add column if not exists status text not null default 'active' check (status in ('active', 'pending_review', 'disabled'));

create table if not exists public.official_promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  channel text not null default 'all' check (channel in ('all', 'shop', 'delivery')),
  schedule_kind text not null default 'range' check (schedule_kind in ('range', 'daily_window', 'weekly')),
  starts_at timestamptz,
  ends_at timestamptz,
  daily_start text,
  daily_end text,
  weekly_days int[] not null default '{}'::int[],
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'ended')),
  created_at timestamptz not null default now()
);

create table if not exists public.official_dispatch_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  value text not null,
  detail text,
  is_active boolean not null default true,
  sort integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.official_delivery_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references public.official_deliveries(id) on delete cascade,
  step text not null,
  created_at timestamptz not null default now()
);

alter table public.official_promotions enable row level security;
alter table public.official_dispatch_rules enable row level security;
alter table public.official_delivery_events enable row level security;

drop policy if exists "official_promotions_admin_read" on public.official_promotions;
drop policy if exists "official_promotions_admin_write" on public.official_promotions;
create policy "official_promotions_admin_read" on public.official_promotions for select using (public.official_is_admin());
create policy "official_promotions_admin_write" on public.official_promotions for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_dispatch_rules_admin_read" on public.official_dispatch_rules;
drop policy if exists "official_dispatch_rules_admin_write" on public.official_dispatch_rules;
create policy "official_dispatch_rules_admin_read" on public.official_dispatch_rules for select using (public.official_is_admin());
create policy "official_dispatch_rules_admin_write" on public.official_dispatch_rules for all using (public.official_is_admin()) with check (public.official_is_admin());

drop policy if exists "official_delivery_events_owner_read" on public.official_delivery_events;
drop policy if exists "official_delivery_events_admin_write" on public.official_delivery_events;
create policy "official_delivery_events_owner_read" on public.official_delivery_events for select using (
  exists(
    select 1
    from public.official_deliveries d
    join public.official_orders o on o.id = d.order_id
    where d.id = official_delivery_events.delivery_id
      and (o.user_id = auth.uid() or public.official_is_admin())
  )
);
create policy "official_delivery_events_admin_write" on public.official_delivery_events for all using (public.official_is_admin()) with check (public.official_is_admin());
