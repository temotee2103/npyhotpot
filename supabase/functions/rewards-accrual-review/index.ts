import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Payload = {
  accrualId?: string;
  action?: "approve" | "reject";
  rejectReason?: string;
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

  const callerProfile = await supabase
    .from("official_profiles")
    .select("id,role,status")
    .eq("id", callerUser.data.user.id)
    .maybeSingle();
  if (callerProfile.error || !callerProfile.data || callerProfile.data.status !== "active" || (callerProfile.data.role !== "admin" && callerProfile.data.role !== "super_admin")) {
    return new Response(JSON.stringify({ message: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const body = (await request.json()) as Payload;
  const accrualId = (body.accrualId ?? "").trim();
  const action = body.action ?? "approve";
  const rejectReason = (body.rejectReason ?? "").trim();
  if (!accrualId || (action !== "approve" && action !== "reject")) {
    return new Response(JSON.stringify({ message: "accrualId and valid action are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (action === "reject" && !rejectReason) {
    return new Response(JSON.stringify({ message: "rejectReason is required when reject" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const accrual = await supabase
    .from("official_member_rewards_accruals")
    .select("id,member_user_id,spend_amount,points_amount,status,submitted_at")
    .eq("id", accrualId)
    .maybeSingle();
  if (accrual.error || !accrual.data?.id) {
    return new Response(JSON.stringify({ message: accrual.error?.message ?? "Accrual not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  if (accrual.data.status !== "submitted") {
    return new Response(JSON.stringify({ message: "Accrual already reviewed" }), {
      status: 409,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  if (action === "reject") {
    const rejected = await supabase
      .from("official_member_rewards_accruals")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString(),
        reviewed_by: callerUser.data.user.id,
        reject_reason: rejectReason,
      })
      .eq("id", accrualId);
    if (rejected.error) {
      return new Response(JSON.stringify({ message: rejected.error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    return new Response(JSON.stringify({ message: "Accrual rejected", data: { id: accrualId, status: "rejected" } }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  const reviewedAt = new Date().toISOString();
  const approved = await supabase
    .from("official_member_rewards_accruals")
    .update({
      status: "approved",
      reviewed_at: reviewedAt,
      reviewed_by: callerUser.data.user.id,
      reject_reason: null,
    })
    .eq("id", accrualId)
    .eq("status", "submitted");
  if (approved.error) {
    return new Response(JSON.stringify({ message: approved.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  await supabase.rpc("official_bind_referral_from_user_metadata", { p_user_id: accrual.data.member_user_id });
  const pointsPost = await supabase.rpc("official_post_points_for_consumption", {
    p_consumer_user_id: accrual.data.member_user_id,
    p_spend_amount: Number(accrual.data.spend_amount ?? 0),
    p_source_type: "merchant_accrual_approved",
    p_source_id: accrualId,
    p_channel: "dine_in",
    p_event_at: accrual.data.submitted_at ?? reviewedAt,
  });
  if (pointsPost.error) {
    return new Response(JSON.stringify({ message: pointsPost.error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
  const pointsData = pointsPost.data as {
    ok?: boolean;
    self_points?: number;
    consumer_next_tier?: string;
    consumer_next_spend?: number;
  } | null;
  if (!pointsData?.ok) {
    return new Response(JSON.stringify({ message: "Points posting failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  await supabase
    .from("official_member_rewards_accruals")
    .update({ points_amount: Number(pointsData.self_points ?? 0) })
    .eq("id", accrualId);

  return new Response(
    JSON.stringify({
      message: "Accrual approved",
      data: {
        id: accrualId,
        status: "approved",
        membershipTier: pointsData.consumer_next_tier ?? "none",
        cumulativeSpendMyr: Number(pointsData.consumer_next_spend ?? 0),
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
  );
});
