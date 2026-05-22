insert into public.official_runtime_settings (key, value)
values
  ('ops_self_heal_cron_secret', md5(random()::text || clock_timestamp()::text || gen_random_uuid()::text)),
  ('stale_coupon_reservation_minutes', '30'),
  ('payex_reconcile_pending_hours', '48'),
  ('dispatch_retry_hours', '24'),
  ('admin_action_logs_retention_days', '180')
on conflict (key) do nothing;

create or replace function public.official_invoke_ops_self_heal_job()
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
  where key = 'ops_self_heal_cron_secret';

  if v_secret is null or trim(v_secret) = '' then
    raise exception 'ops_self_heal_cron_secret is missing';
  end if;

  select net.http_post(
    url := 'https://vlsgsrkldybzqwttmvrt.supabase.co/functions/v1/ops-self-heal',
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

create or replace function public.official_purge_old_admin_action_logs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := 180;
  v_deleted integer := 0;
begin
  select coalesce(nullif(value, '')::integer, 180)
  into v_days
  from public.official_runtime_settings
  where key = 'admin_action_logs_retention_days';

  with deleted as (
    delete from public.official_admin_action_logs
    where created_at < now() - make_interval(days => v_days)
    returning 1
  )
  select count(*) into v_deleted from deleted;

  return v_deleted;
end;
$$;

do $$
declare
  v_job_id bigint;
begin
  for v_job_id in
    select jobid from cron.job where jobname in ('official-ops-self-heal-every-10m', 'official-admin-action-log-retention-daily')
  loop
    perform cron.unschedule(v_job_id);
  end loop;
end $$;

select cron.schedule(
  'official-ops-self-heal-every-10m',
  '*/10 * * * *',
  $$select public.official_invoke_ops_self_heal_job();$$
);

select cron.schedule(
  'official-admin-action-log-retention-daily',
  '15 3 * * *',
  $$select public.official_purge_old_admin_action_logs();$$
);
