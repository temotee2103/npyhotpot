create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists public.official_runtime_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.official_runtime_settings enable row level security;

drop policy if exists "official_runtime_settings_admin_read" on public.official_runtime_settings;
create policy "official_runtime_settings_admin_read"
on public.official_runtime_settings
for select
using (public.official_is_admin());

drop policy if exists "official_runtime_settings_admin_write" on public.official_runtime_settings;
create policy "official_runtime_settings_admin_write"
on public.official_runtime_settings
for all
using (public.official_is_admin())
with check (public.official_is_admin());

insert into public.official_runtime_settings (key, value)
values ('delivery_sync_cron_secret', md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text))
on conflict (key) do nothing;

create or replace function public.official_invoke_delivery_sync_job()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_request_id bigint;
begin
  select value
  into v_secret
  from public.official_runtime_settings
  where key = 'delivery_sync_cron_secret';

  if v_secret is null or trim(v_secret) = '' then
    raise exception 'delivery_sync_cron_secret is missing';
  end if;

  select net.http_post(
    url := 'https://vlsgsrkldybzqwttmvrt.supabase.co/functions/v1/delivery-admin-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', v_secret
    ),
    body := '{}'::jsonb
  )
  into v_request_id;

  return v_request_id;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid
    from cron.job
    where jobname = 'official-delivery-sync-every-5m'
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end $$;

select cron.schedule(
  'official-delivery-sync-every-5m',
  '*/5 * * * *',
  $$select public.official_invoke_delivery_sync_job();$$
);
