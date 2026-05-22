update public.official_admin_ui
set payload = replace(payload::text, '"Option Groups"', '"规格组管理"')::jsonb
where key in ('admin_nav_groups', 'admin_delivery_module_cards');

