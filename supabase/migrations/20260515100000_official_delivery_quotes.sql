create table if not exists public.official_delivery_quotes (
  quotation_id text primary key,
  user_id uuid references public.official_profiles(id) on delete set null,
  service_type text not null,
  currency text not null,
  fee numeric(10,2) not null default 0,
  distance_meters integer,
  price_breakdown jsonb not null default '{}'::jsonb,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists official_delivery_quotes_user_created_idx
  on public.official_delivery_quotes (user_id, created_at desc);
