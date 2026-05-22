create or replace function public.official_checkout_delivery(
  p_user_id uuid,
  p_currency text,
  p_items jsonb,
  p_shipping jsonb,
  p_discount_total numeric,
  p_coupon_ids uuid[],
  p_coupon_codes text[],
  p_primary_coupon_id uuid,
  p_primary_coupon_code text,
  p_quotation_id text,
  p_outlet_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_payment_id uuid;
  v_subtotal numeric;
  v_total numeric;
  v_shipping_fee numeric;
  v_coupon_count integer;
  v_updated integer;
  v_quote record;
begin
  select *
  into v_quote
  from public.official_delivery_quotes q
  where q.quotation_id = p_quotation_id
    and q.user_id = p_user_id
    and (q.expires_at is null or q.expires_at > now());

  if not found then
    raise exception 'Invalid or expired quotation';
  end if;

  if v_quote.currency is distinct from p_currency then
    raise exception 'Quotation currency mismatch';
  end if;

  v_shipping_fee := coalesce(v_quote.fee, 0);

  select coalesce(
    sum(
      coalesce((x->>'quantity')::numeric, 1) * coalesce((x->>'unit_price')::numeric, 0)
    ),
    0
  )
  into v_subtotal
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as x;

  v_total := greatest(
    coalesce(v_subtotal, 0) + coalesce(v_shipping_fee, 0) - coalesce(p_discount_total, 0),
    0
  );

  insert into public.official_orders (
    user_id,
    channel,
    outlet_id,
    currency,
    status,
    subtotal,
    shipping_fee,
    discount_total,
    total,
    ship_full_name,
    ship_phone,
    ship_postcode,
    ship_address,
    user_coupon_id,
    coupon_code,
    user_coupon_ids,
    coupon_codes
  )
  values (
    p_user_id,
    'delivery',
    p_outlet_id,
    p_currency,
    'created',
    v_subtotal,
    coalesce(v_shipping_fee, 0),
    coalesce(p_discount_total, 0),
    v_total,
    nullif(p_shipping->>'full_name', ''),
    nullif(p_shipping->>'phone', ''),
    nullif(p_shipping->>'postcode', ''),
    nullif(p_shipping->>'address', ''),
    p_primary_coupon_id,
    nullif(p_primary_coupon_code, ''),
    coalesce(p_coupon_ids, '{}'::uuid[]),
    coalesce(p_coupon_codes, '{}'::text[])
  )
  returning id into v_order_id;

  v_coupon_count := coalesce(array_length(p_coupon_ids, 1), 0);
  if v_coupon_count > 0 then
    update public.official_user_coupons
    set reserved_order_id = v_order_id,
        reserved_at = now()
    where user_id = p_user_id
      and id = any(p_coupon_ids)
      and status = 'issued'
      and reserved_order_id is null
      and (expires_at is null or expires_at > now());

    get diagnostics v_updated = row_count;
    if v_updated <> v_coupon_count then
      raise exception 'Failed to reserve all coupons (expected %, updated %)', v_coupon_count, v_updated;
    end if;
  end if;

  insert into public.official_order_items (
    order_id,
    item_type,
    item_id,
    title,
    quantity,
    unit_price
  )
  select
    v_order_id,
    coalesce(nullif(x->>'item_type', ''), 'menu_item'),
    (x->>'item_id')::uuid,
    nullif(x->>'title', ''),
    coalesce((x->>'quantity')::integer, 1),
    coalesce((x->>'unit_price')::numeric, 0)
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as x;

  v_payment_id := gen_random_uuid();
  insert into public.official_payments (
    id,
    order_id,
    gateway_ref,
    status,
    amount,
    provider,
    method,
    is_active
  )
  values (
    v_payment_id,
    v_order_id,
    'PENDING-' || v_payment_id::text,
    'created',
    v_total,
    'Payex',
    'redirect',
    true
  );

  update public.official_orders
  set active_payment_id = v_payment_id
  where id = v_order_id;

  return jsonb_build_object(
    'ok', true,
    'order_id', v_order_id,
    'payment_id', v_payment_id,
    'subtotal', v_subtotal,
    'shipping_fee', v_shipping_fee,
    'total', v_total
  );
end;
$$;
