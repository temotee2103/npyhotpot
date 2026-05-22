import { supabase } from "@/lib/supabase";

export type OfficialOrderRow = {
  id: string;
  user_id: string | null;
  outlet_id: string | null;
  channel: "shop" | "delivery";
  currency: "MYR" | "SGD";
  status: string;
  active_payment_id: string | null;
  subtotal: number;
  shipping_fee: number;
  discount_total: number;
  total: number;
  coupon_code: string | null;
  ship_full_name: string | null;
  ship_phone: string | null;
  ship_postcode: string | null;
  ship_address: string | null;
  created_at: string;
  official_profiles?: { full_name: string | null; phone: string | null } | null;
};

export type OfficialOrderItemRow = {
  id: string;
  order_id: string;
  item_type: "soup_pack_variant" | "menu_item" | "bundle";
  item_id: string;
  title: string | null;
  quantity: number;
  unit_price: number;
};

export type OfficialPaymentRow = {
  id: string;
  order_id: string;
  gateway_ref: string | null;
  status: string;
  amount: number;
  method: string | null;
  provider: string | null;
  is_active?: boolean | null;
  created_at: string;
};

export type OfficialDeliveryRow = {
  id: string;
  order_id: string;
  lalamove_order_id: string | null;
  status: string;
  pickup_outlet_id: string | null;
  dropoff_address: string;
  created_at: string;
  provider_payload?: unknown;
  official_outlets?: { name: string | null; location: string | null } | null;
  official_orders?: { id: string; channel: "shop" | "delivery" } | null;
};

export type OfficialDeliveryEventRow = {
  id: string;
  delivery_id: string;
  step: string;
  provider_status: string | null;
  created_at: string;
};

export type AdminDeliveryOrderManagementRow = {
  order: OfficialOrderRow;
  payment: OfficialPaymentRow | null;
  delivery: OfficialDeliveryRow | null;
  events: OfficialDeliveryEventRow[];
};

export async function fetchOfficialOrders(limit = 50): Promise<OfficialOrderRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_orders")
    .select(
      "id,user_id,outlet_id,channel,currency,status,active_payment_id,subtotal,shipping_fee,discount_total,total,coupon_code,ship_full_name,ship_phone,ship_postcode,ship_address,created_at,official_profiles(full_name,phone)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown) as OfficialOrderRow[];
}

export async function fetchOfficialOrderById(id: string): Promise<OfficialOrderRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("official_orders")
    .select(
      "id,user_id,outlet_id,channel,currency,status,subtotal,shipping_fee,discount_total,total,coupon_code,ship_full_name,ship_phone,ship_postcode,ship_address,created_at,official_profiles(full_name,phone)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return (data as unknown) as OfficialOrderRow;
}

export async function fetchOfficialOrderItems(orderId: string): Promise<OfficialOrderItemRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_order_items")
    .select("id,order_id,item_type,item_id,title,quantity,unit_price")
    .eq("order_id", orderId);
  if (error || !data) return [];
  return (data as unknown) as OfficialOrderItemRow[];
}

export async function fetchOfficialPaymentsByOrderId(orderId: string): Promise<OfficialPaymentRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_payments")
    .select("id,order_id,gateway_ref,status,amount,method,provider,created_at")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown) as OfficialPaymentRow[];
}

export async function fetchOfficialDeliveryByOrderId(orderId: string): Promise<OfficialDeliveryRow | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("official_deliveries")
    .select("id,order_id,lalamove_order_id,status,pickup_outlet_id,dropoff_address,created_at,official_outlets(name,location),official_orders(id,channel)")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as unknown) as OfficialDeliveryRow;
}

export async function fetchOfficialDeliveries(limit = 50): Promise<OfficialDeliveryRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_deliveries")
    .select("id,order_id,lalamove_order_id,status,pickup_outlet_id,dropoff_address,created_at,provider_payload,official_outlets(name,location),official_orders(id,channel)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown) as OfficialDeliveryRow[];
}

export async function fetchOfficialDeliveryEvents(deliveryId: string): Promise<OfficialDeliveryEventRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_delivery_events")
    .select("id,delivery_id,step,provider_status,created_at")
    .eq("delivery_id", deliveryId)
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return (data as unknown) as OfficialDeliveryEventRow[];
}

export async function fetchOrderCounts(): Promise<{
  total: number;
  shop: number;
  delivery: number;
}> {
  if (!supabase) return { total: 0, shop: 0, delivery: 0 };

  const total = await supabase.from("official_orders").select("id", { count: "exact", head: true });
  const shop = await supabase.from("official_orders").select("id", { count: "exact", head: true }).eq("channel", "shop");
  const delivery = await supabase.from("official_orders").select("id", { count: "exact", head: true }).eq("channel", "delivery");

  return {
    total: total.count ?? 0,
    shop: shop.count ?? 0,
    delivery: delivery.count ?? 0,
  };
}

export async function fetchAdminDeliveryOrderManagementRows(limit = 120): Promise<AdminDeliveryOrderManagementRow[]> {
  if (!supabase) return [];

  const orders = await fetchOfficialOrders(limit);
  const deliveryOrders = orders.filter((order) => order.channel === "delivery");
  if (deliveryOrders.length === 0) return [];

  const orderIds = deliveryOrders.map((x) => x.id);
  const deliveriesRes = await supabase
    .from("official_deliveries")
    .select("id,order_id,lalamove_order_id,status,pickup_outlet_id,dropoff_address,created_at,provider_payload,official_outlets(name,location),official_orders(id,channel)")
    .in("order_id", orderIds);
  const paymentsRes = await supabase
    .from("official_payments")
    .select("id,order_id,gateway_ref,status,amount,method,provider,is_active,created_at")
    .in("order_id", orderIds)
    .order("created_at", { ascending: false });

  if (deliveriesRes.error || paymentsRes.error) return [];

  const deliveries = ((deliveriesRes.data ?? []) as unknown) as OfficialDeliveryRow[];
  const payments = ((paymentsRes.data ?? []) as unknown) as OfficialPaymentRow[];

  const paymentByOrderId = new Map<string, OfficialPaymentRow>();
  const paymentById = new Map<string, OfficialPaymentRow>();
  for (const payment of payments) {
    paymentById.set(payment.id, payment);
    if (!paymentByOrderId.has(payment.order_id)) paymentByOrderId.set(payment.order_id, payment);
  }

  const deliveryByOrderId = new Map<string, OfficialDeliveryRow>();
  for (const delivery of deliveries) {
    if (!deliveryByOrderId.has(delivery.order_id)) deliveryByOrderId.set(delivery.order_id, delivery);
  }

  const deliveryIds = deliveries.map((x) => x.id);
  const eventsRes =
    deliveryIds.length === 0
      ? { data: [] as OfficialDeliveryEventRow[], error: null }
      : await supabase
          .from("official_delivery_events")
          .select("id,delivery_id,step,provider_status,created_at")
          .in("delivery_id", deliveryIds)
          .order("created_at", { ascending: true });

  if (eventsRes.error) return [];
  const events = ((eventsRes.data ?? []) as unknown) as OfficialDeliveryEventRow[];
  const eventsByDeliveryId = new Map<string, OfficialDeliveryEventRow[]>();
  for (const event of events) {
    const rows = eventsByDeliveryId.get(event.delivery_id) ?? [];
    rows.push(event);
    eventsByDeliveryId.set(event.delivery_id, rows);
  }

  return deliveryOrders.map((order) => {
    const delivery = deliveryByOrderId.get(order.id) ?? null;
    return {
      order,
      payment: (order.active_payment_id ? paymentById.get(order.active_payment_id) : null) ?? paymentByOrderId.get(order.id) ?? null,
      delivery,
      events: delivery ? eventsByDeliveryId.get(delivery.id) ?? [] : [],
    };
  });
}
