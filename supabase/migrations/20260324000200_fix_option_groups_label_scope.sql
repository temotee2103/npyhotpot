update public.official_admin_ui
set payload = replace(
  replace(payload::text, '"label":"Option Groups"', '"label":"规格组"'),
  '"label":"规格组管理"',
  '"label":"规格组"'
)::jsonb
where key = 'admin_nav_groups';

update public.official_admin_ui
set payload = replace(
  replace(payload::text, '"title":"规格组管理"', '"title":"Option Groups"'),
  '"title":"规格组"',
  '"title":"Option Groups"'
)::jsonb
where key = 'admin_delivery_module_cards';

