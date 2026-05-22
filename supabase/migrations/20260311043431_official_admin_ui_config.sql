create table if not exists public.official_admin_ui (
  key text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.official_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists official_admin_ui_touch_updated_at on public.official_admin_ui;
create trigger official_admin_ui_touch_updated_at
before update on public.official_admin_ui
for each row
execute function public.official_touch_updated_at();

alter table public.official_admin_ui enable row level security;

drop policy if exists "official_admin_ui_admin_read" on public.official_admin_ui;
drop policy if exists "official_admin_ui_admin_write" on public.official_admin_ui;
create policy "official_admin_ui_admin_read" on public.official_admin_ui for select using (public.official_is_admin());
create policy "official_admin_ui_admin_write" on public.official_admin_ui for all using (public.official_is_admin()) with check (public.official_is_admin());
