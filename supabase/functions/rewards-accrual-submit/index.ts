import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  rewardsCode?: string;
  spendAmount?: number;
  receiptUrl?: string;
  receiptFingerprint?: string;
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
  const rewardsCode = (body.rewardsCode ?? "").trim().toUpperCase();
  const spendAmount = Number(body.spendAmount ?? 0);
  const receiptUrl = (body.receiptUrl ?? "").trim();
  const receiptFingerprint = (body.receiptFingerprint ?? "").trim() || null;
  if (!rewardsCode || !Number.isFinite(spendAmount) || spendAmount <= 0 || !receiptUrl) {
    return new Response(JSON.stringify({ message: "rewardsCode, spendAmount and receiptUrl are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const member = await supabase
    .from("official_member_rewards_accounts")
    .select("user_id,status")
    .eq("rewards_code", rewardsCode)
    .eq("status", "active")
    .maybeSingle();
  if (member.error || !member.data?.user_id) {
    return new Response(JSON.stringify({ message: member.error?.message ?? "Member rewards code not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const pointsAmount = Math.max(0, Math.floor(spendAmount));
  const inserted = await supabase
    .from("official_member_rewards_accruals")
    .insert({
      member_user_id: member.data.user_id,
      merchant_id: merchant.data.id,
      outlet_id: merchant.data.outlet_id,
      spend_amount: spendAmount,
      points_amount: pointsAmount,
      receipt_url: receiptUrl,
      receipt_fingerprint: receiptFingerprint,
      status: "submitted",
    })
    .select("id,status,submitted_at,spend_amount,points_amount")
    .maybeSingle();

  if (inserted.error || !inserted.data?.id) {
    return new Response(JSON.stringify({ message: inserted.error?.message ?? "Submit accrual failed" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  return new Response(JSON.stringify({ message: "Accrual submitted", data: inserted.data }), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
});

