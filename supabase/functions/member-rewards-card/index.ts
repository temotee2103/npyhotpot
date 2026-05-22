import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

  const userRes = await supabase.auth.getUser(token);
  const userId = userRes.data.user?.id;
  if (userRes.error || !userId) {
    return new Response(JSON.stringify({ message: userRes.error?.message ?? "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const profile = await supabase
    .from("official_profiles")
    .select("id,full_name,membership_tier,cumulative_spend_myr,status")
    .eq("id", userId)
    .maybeSingle();
  if (profile.error || !profile.data?.id) {
    return new Response(JSON.stringify({ message: profile.error?.message ?? "Profile not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  await supabase.rpc("official_bind_referral_from_user_metadata", { p_user_id: userId });

  let account = await supabase
    .from("official_member_rewards_accounts")
    .select("user_id,rewards_code,qr_payload,status")
    .eq("user_id", userId)
    .maybeSingle();
  if (account.error) {
    return new Response(JSON.stringify({ message: account.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (!account.data?.user_id) {
    const created = await supabase
      .from("official_member_rewards_accounts")
      .insert({ user_id: userId, status: "active" })
      .select("user_id,rewards_code,qr_payload,status")
      .maybeSingle();
    if (created.error || !created.data?.user_id) {
      return new Response(JSON.stringify({ message: created.error?.message ?? "Create rewards account failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    account = created;
  }

  const rewardsCode = account.data.rewards_code;
  const qrPayload = (account.data.qr_payload ?? rewardsCode ?? "").trim();
  if (!account.data.qr_payload && qrPayload) {
    await supabase.from("official_member_rewards_accounts").update({ qr_payload: qrPayload }).eq("user_id", userId);
  }

  const pointsBalanceRpc = await supabase.rpc("official_get_member_points_balance", { p_user_id: userId });
  if (pointsBalanceRpc.error) {
    return new Response(JSON.stringify({ message: pointsBalanceRpc.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const pointsBalance = Number(pointsBalanceRpc.data ?? 0);

  return new Response(
    JSON.stringify({
      message: "ok",
      data: {
        fullName: profile.data.full_name ?? "",
        membershipTier: profile.data.membership_tier ?? "none",
        cumulativeSpendMyr: Number(profile.data.cumulative_spend_myr ?? 0),
        rewardsCode,
        qrPayload,
        pointsBalance,
        status: account.data.status ?? "active",
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
});
