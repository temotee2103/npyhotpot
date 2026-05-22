alter table public.official_discounts
add column if not exists channel text;

update public.official_discounts
set channel = 'shop'
where channel is null;

alter table public.official_discounts
alter column channel set default 'shop';

alter table public.official_discounts
alter column channel set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'official_discounts_channel_check'
      and conrelid = 'public.official_discounts'::regclass
  ) then
    alter table public.official_discounts
    add constraint official_discounts_channel_check check (channel in ('shop', 'delivery'));
  end if;
end$$;

