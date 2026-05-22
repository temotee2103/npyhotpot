alter table public.official_deliveries
add column if not exists provider text not null default 'lalamove',
add column if not exists quotation_id text,
add column if not exists quotation_expires_at timestamptz,
add column if not exists price_breakdown jsonb,
add column if not exists distance_meters numeric(10,2),
add column if not exists provider_payload jsonb,
add column if not exists pod_payload jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'official_deliveries_provider_check'
      and conrelid = 'public.official_deliveries'::regclass
  ) then
    alter table public.official_deliveries
    add constraint official_deliveries_provider_check check (provider in ('lalamove'));
  end if;
end$$;

alter table public.official_delivery_events
add column if not exists provider_status text,
add column if not exists provider_payload jsonb;

