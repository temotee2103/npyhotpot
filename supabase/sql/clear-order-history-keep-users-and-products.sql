begin;

-- Preserve:
-- - auth.users
-- - official_profiles
-- - official_user_coupons
-- - official_menu_*
-- - official_soup_pack_*
-- - official_outlets
-- - referral data
-- - non-order member rewards/accrual history
--
-- Remove:
-- - official_orders
-- - official_order_items
-- - official_order_adjustments
-- - official_payments
-- - official_payment_contexts
-- - official_deliveries
-- - official_delivery_events
-- - order-derived points ledger rows (`source_type = 'order_paid'`)
--
-- Why not TRUNCATE?
-- `official_user_coupons` references `official_orders` via `reserved_order_id` / `redeemed_order_id`.
-- Using TRUNCATE ... CASCADE on `official_orders` can also affect coupon data you asked to keep.
-- DELETE is safer here because FK actions will cascade or set null correctly.

update public.official_user_coupons
set
  reserved_order_id = null,
  reserved_at = null,
  redeemed_order_id = null
where reserved_order_id is not null
   or redeemed_order_id is not null;

delete from public.official_points_ledger
where source_type = 'order_paid';

delete from public.official_orders;

commit;

-- The single DELETE above will also clear dependent order-history tables through FK rules:
-- - public.official_order_items
-- - public.official_order_adjustments
-- - public.official_payments
-- - public.official_payment_contexts
-- - public.official_deliveries
-- - public.official_delivery_events
--
-- And it will preserve user-related data while nulling coupon order links when needed:
-- - public.official_profiles
-- - auth.users
-- - public.official_user_coupons
-- - public.official_points_ledger (except `source_type = 'order_paid'`)
-- - public.official_member_rewards_accounts
-- - public.official_member_rewards_accruals
-- - public.official_referrals
-- - public.official_coupon_templates
-- - public.official_coupon_issuance_rules
-- - public.official_menu_*
-- - public.official_soup_pack_*
-- - public.official_outlets
