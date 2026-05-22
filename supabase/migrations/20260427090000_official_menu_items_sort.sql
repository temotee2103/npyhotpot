alter table public.official_menu_items
add column if not exists sort integer not null default 0;

with ranked as (
  select
    id,
    row_number() over (
      order by
        case when sort > 0 then 0 else 1 end,
        nullif(sort, 0),
        created_at,
        id
    ) as next_sort
  from public.official_menu_items
)
update public.official_menu_items items
set sort = ranked.next_sort
from ranked
where items.id = ranked.id
  and coalesce(items.sort, 0) <> ranked.next_sort;
