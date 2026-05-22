import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { applyCouponsForCheckout, normalizeCouponCodes } from "../_shared/coupon.ts";
import { buildCorsHeaders, isCorsAllowed } from "../_shared/cors.ts";

type ShopCartItem =
  | { kind: "variant"; id: string; qty: number }
  | { kind: "bundle"; id: string; bundleId: string; qty: number };

type CheckoutShopPayload = {
  action?: "checkout";
  currency?: "MYR" | "SGD";
  cart?: { items?: ShopCartItem[] };
  shipping?: {
    full_name?: string;
    phone?: string;
    address?: string;
    postcode?: string;
    shipping_fee?: number;
  };
  subtotal?: number;
  discountTotal?: number;
  total?: number;
  couponCode?: string;
  couponCodes?: string[];
};

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

serve(async (request) => {
  const corsHeaders = buildCorsHeaders(request);
  if (!isCorsAllowed(request)) {
    return new Response(JSON.stringify({ message: "CORS origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 405,
    });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return new Response(JSON.stringify({ message: "Supabase service role not configured" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 500,
    });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  let userId: string | null = null;
  if (token) {
    const userRes = await supabase.auth.getUser(token);
    if (!userRes.error && userRes.data.user?.id) {
      userId = userRes.data.user.id;
    }
  }

  const body = (await request.json()) as CheckoutShopPayload;
  if (!body?.currency || !body?.shipping?.full_name || !body?.shipping?.phone || !body?.shipping?.address || !Array.isArray(body?.cart?.items)) {
    return new Response(JSON.stringify({ message: "Invalid checkout payload" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 400,
    });
  }

  const cartItems = body.cart.items.filter((x) => x.id && Number(x.qty) > 0);
  if (!cartItems.length) {
    return new Response(JSON.stringify({ message: "Cart is empty" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 400,
    });
  }

  const shippingFee = Number(body.shipping.shipping_fee ?? 0);
  const requestedCouponCodes = normalizeCouponCodes([...(body.couponCodes ?? []), body.couponCode ?? ""]);

  const variantIds = [...new Set(cartItems.filter((item) => item.kind !== "bundle").map((item) => item.id))];
  const bundleIds = [...new Set(cartItems.filter((item) => item.kind === "bundle").map((item) => item.bundleId))];

  const variantPriceMap = new Map<string, number>();
  if (variantIds.length > 0) {
    const variantPrices = await supabase
      .from("official_soup_pack_prices")
      .select("variant_id,currency,price")
      .eq("currency", body.currency)
      .in("variant_id", variantIds);
    if (!variantPrices.error) {
      for (const row of variantPrices.data ?? []) {
        const variantId = typeof row.variant_id === "string" ? row.variant_id : "";
        const price = Number(row.price ?? 0);
        if (variantId && Number.isFinite(price)) variantPriceMap.set(variantId, Math.max(0, price));
      }
    }
  }

  const bundlePriceMap = new Map<string, number>();
  const bundleTitleMap = new Map<string, string>();
  if (bundleIds.length > 0) {
    const bundles = await supabase
      .from("official_soup_pack_bundles")
      .select("id,title,myr_price,sgd_price")
      .in("id", bundleIds);
    if (!bundles.error) {
      for (const row of bundles.data ?? []) {
        const bundleId = typeof row.id === "string" ? row.id : "";
        const title = typeof row.title === "string" ? row.title : "";
        const price = Number(body.currency === "SGD" ? row.sgd_price ?? 0 : row.myr_price ?? 0);
        if (bundleId && Number.isFinite(price)) bundlePriceMap.set(bundleId, Math.max(0, price));
        if (bundleId && title) bundleTitleMap.set(bundleId, title);
      }
    }
  }

  const variantTitleMap = new Map<string, string>();
  if (variantIds.length > 0) {
    const variants = await supabase.from("official_soup_pack_variants").select("id,title").in("id", variantIds);
    if (!variants.error) {
      for (const row of variants.data ?? []) {
        const variantId = typeof row.id === "string" ? row.id : "";
        const title = typeof row.title === "string" ? row.title : "";
        if (variantId && title) variantTitleMap.set(variantId, title);
      }
    }
  }

  const computedSubtotal = Number(
    cartItems
      .reduce((sum, item) => {
        const unitPrice = item.kind === "bundle" ? Number(bundlePriceMap.get(item.bundleId) ?? 0) : Number(variantPriceMap.get(item.id) ?? 0);
        return sum + unitPrice * Number(item.qty);
      }, 0)
      .toFixed(2),
  );

  const couponApply = await applyCouponsForCheckout({
    supabase: supabase as never,
    couponCodes: requestedCouponCodes,
    userId,
    channel: "shop",
    currency: body.currency,
    subtotal: computedSubtotal,
  });
  if (!couponApply.ok) {
    return new Response(JSON.stringify({ message: couponApply.message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: couponApply.reason === "not_authenticated" ? 401 : 400,
    });
  }

  const appliedCouponId = couponApply.primaryCouponId;
  const appliedCouponCode = couponApply.primaryCouponCode;
  const resolvedDiscountTotal = couponApply.totalDiscount;

  const items = cartItems.map((item) => {
    if (item.kind === "bundle") {
      const bundleId = item.bundleId;
      return {
        item_type: "bundle",
        item_id: bundleId,
        title: bundleTitleMap.get(bundleId) ?? "",
        quantity: Number(item.qty),
        unit_price: Number(bundlePriceMap.get(bundleId) ?? 0),
      };
    }
    const variantId = item.id;
    return {
      item_type: "soup_pack_variant",
      item_id: variantId,
      title: variantTitleMap.get(variantId) ?? "",
      quantity: Number(item.qty),
      unit_price: Number(variantPriceMap.get(variantId) ?? 0),
    };
  });

  const checkout = await supabase.rpc("official_checkout_shop", {
    p_user_id: userId,
    p_currency: body.currency,
    p_items: items,
    p_shipping: {
      full_name: body.shipping.full_name,
      phone: body.shipping.phone,
      address: body.shipping.address,
      postcode: body.shipping.postcode ?? "",
    },
    p_shipping_fee: shippingFee,
    p_discount_total: resolvedDiscountTotal,
    p_coupon_ids: couponApply.couponIds,
    p_coupon_codes: couponApply.couponCodes,
    p_primary_coupon_id: appliedCouponId,
    p_primary_coupon_code: appliedCouponCode,
  });

  const checkoutData = checkout.data as unknown as { ok?: boolean; order_id?: string; payment_id?: string } | null;
  if (checkout.error || !checkoutData?.ok || !checkoutData.order_id || !checkoutData.payment_id) {
    return new Response(JSON.stringify({ message: checkout.error?.message ?? "Create order failed" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 500,
    });
  }

  const payment = await supabase.from("official_payments").select("status").eq("id", checkoutData.payment_id).maybeSingle();
  if (payment.error || !payment.data) {
    return new Response(JSON.stringify({ message: payment.error?.message ?? "Create order failed" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 500,
    });
  }

  return new Response(
    JSON.stringify({
      message: "Order created, ready for payment intent",
      data: {
        officialOrderId: checkoutData.order_id,
        paymentStatus: (payment.data as { status?: string }).status,
      },
    }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    },
  );
});
