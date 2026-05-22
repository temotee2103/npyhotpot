create table if not exists public.official_admin_action_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text null,
  action text not null,
  target_type text not null,
  target_id text null,
  channel text null,
  status text not null default 'success',
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_official_admin_action_logs_created_at
on public.official_admin_action_logs (created_at desc);

create index if not exists idx_official_admin_action_logs_action
on public.official_admin_action_logs (action);

create index if not exists idx_official_admin_action_logs_target
on public.official_admin_action_logs (target_type, target_id);

alter table public.official_admin_action_logs enable row level security;

drop policy if exists "official_admin_action_logs_admin_read" on public.official_admin_action_logs;
create policy "official_admin_action_logs_admin_read"
on public.official_admin_action_logs
for select
using (public.official_is_admin());
