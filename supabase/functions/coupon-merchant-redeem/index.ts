import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { fetchCouponByCode, markCouponRedeemed, validateCouponForUse } from "../_shared/coupon.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  couponCode?: string;
  spendAmount?: number;
  currency?: "MYR" | "SGD";
  posConfirmed?: boolean;
  operatorNote?: string;
};

function getSupabaseAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return null;
  return createClient(supabaseUrl, serviceRoleKey);
}

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ message: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return new Response(JSON.stringify({ message: "Supabase service role not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const callerUser = await supabase.auth.getUser(token);
  if (callerUser.error || !callerUser.data.user) {
    return new Response(JSON.stringify({ message: callerUser.error?.message ?? "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const merchant = await supabase
    .from("official_merchant_accounts")
    .select("id,profile_id,outlet_id,status")
    .eq("profile_id", callerUser.data.user.id)
    .eq("status", "active")
    .maybeSingle();
  if (merchant.error || !merchant.data?.id) {
    return new Response(JSON.stringify({ message: merchant.error?.message ?? "Merchant account not found or inactive" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const body = (await request.json()) as Payload;
  const couponCode = (body.couponCode ?? "").trim().toUpperCase();
  const spendAmount = Number(body.spendAmount ?? 0);
  const currency = body.currency === "SGD" ? "SGD" : "MYR";
  const posConfirmed = body.posConfirmed === true;
  const operatorNote = String(body.operatorNote ?? "").trim().slice(0, 280);
  if (!couponCode || !Number.isFinite(spendAmount) || spendAmount <= 0) {
    return new Response(JSON.stringify({ message: "couponCode and spendAmount are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (!posConfirmed) {
    return new Response(JSON.stringify({ message: "请先确认已在 POS 手动扣减对应金额" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const coupon = await fetchCouponByCode(supabase as never, couponCode);
  const validation = validateCouponForUse({
    coupon,
    channel: "dine_in",
    currency,
    subtotal: spendAmount,
    allowAnyOwner: true,
  });
  if (!validation.ok) {
    return new Response(JSON.stringify({ message: validation.message }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  await markCouponRedeemed(supabase as never, {
    couponId: validation.coupon.id,
    channel: "dine_in",
    redeemedBy: merchant.data.profile_id ?? callerUser.data.user.id,
    outletId: merchant.data.outlet_id ?? null,
  });
  await supabase
    .from("official_user_coupons")
    .update({
      meta: {
        ...(validation.coupon.meta ?? {}),
        merchant_redemption: {
          pos_confirmed: true,
          operator_note: operatorNote || null,
          spend_amount: spendAmount,
          currency,
          redeemed_at: new Date().toISOString(),
          merchant_profile_id: merchant.data.profile_id ?? callerUser.data.user.id,
          outlet_id: merchant.data.outlet_id ?? null,
        },
      },
    })
    .eq("id", validation.coupon.id);

  return new Response(
    JSON.stringify({
      message: "Coupon redeemed",
      data: {
        couponId: validation.coupon.id,
        couponCode: validation.coupon.coupon_instance_code,
        templateId: validation.template.id,
        templateCode: validation.template.code,
        templateTitle: validation.template.title,
        discountAmount: validation.discountAmount,
        currency,
        memberUserId: validation.coupon.user_id,
        outletId: merchant.data.outlet_id ?? null,
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
});
