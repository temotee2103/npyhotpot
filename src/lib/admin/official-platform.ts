import { supabase } from "@/lib/supabase";

export type OfficialPromotion = {
  id: string;
  title: string;
  image_url: string | null;
  video_url: string | null;
  channel: "all" | "shop" | "delivery";
  schedule_kind: "range" | "daily_window" | "weekly";
  starts_at: string | null;
  ends_at: string | null;
  daily_start: string | null;
  daily_end: string | null;
  weekly_days: number[];
  status: "draft" | "scheduled" | "active" | "paused" | "ended";
  created_at: string;
};

export type OfficialDispatchRule = {
  id: string;
  name: string;
  value: string;
  detail: string | null;
  is_active: boolean;
  sort: number;
};

export type OfficialProfileRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  address: string | null;
  birth_date: string | null;
  role: "customer" | "merchant" | "admin" | "super_admin";
  status: "active" | "pending_review" | "disabled";
  membership_tier: "none" | "bronze" | "silver" | "gold";
  cumulative_spend_myr: number;
  created_at: string;
};

export type OfficialOutletRow = {
  id: string;
  name: string;
  location: string;
  operating_hours: string;
  is_active: boolean;
};

export type OfficialMerchantAccountRow = {
  id: string;
  profile_id: string;
  outlet_id: string;
  status: "active" | "disabled";
  official_outlets?: { name: string; location: string } | null;
};

export type OfficialPaymentWithOrder = {
  id: string;
  gateway_ref: string | null;
  status: string;
  amount: number;
  method: string | null;
  provider: string | null;
  created_at: string;
  official_orders?: { id: string; channel: "shop" | "delivery"; currency: "MYR" | "SGD" } | null;
};

export async function fetchOfficialPromotions(): Promise<OfficialPromotion[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_promotions")
    .select("id,title,image_url,video_url,channel,schedule_kind,starts_at,ends_at,daily_start,daily_end,weekly_days,status,created_at")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown) as OfficialPromotion[];
}

export async function fetchOfficialPromotionsByChannel(channel: "shop" | "delivery"): Promise<OfficialPromotion[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_promotions")
    .select("id,title,image_url,video_url,channel,schedule_kind,starts_at,ends_at,daily_start,daily_end,weekly_days,status,created_at")
    .eq("channel", channel)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown) as OfficialPromotion[];
}

export async function fetchActivePromotionsPublic(channel: "shop" | "delivery"): Promise<OfficialPromotion[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_promotions")
    .select("id,title,image_url,video_url,channel,schedule_kind,starts_at,ends_at,daily_start,daily_end,weekly_days,status,created_at")
    .eq("channel", channel)
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return (data as unknown) as OfficialPromotion[];
}

export async function createOfficialPromotionDraft(channel: "shop" | "delivery"): Promise<{ id: string } | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("official_promotions")
    .insert({
      title: "新促销",
      channel,
      schedule_kind: "range",
      status: "draft",
      weekly_days: [],
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return { id: (data as { id: string }).id };
}

export async function fetchOfficialPromotionById(id: string): Promise<OfficialPromotion | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("official_promotions")
    .select("id,title,image_url,video_url,channel,schedule_kind,starts_at,ends_at,daily_start,daily_end,weekly_days,status,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return (data as unknown) as OfficialPromotion;
}

export async function updateOfficialPromotion(args: {
  id: string;
  title: string;
  channel: "shop" | "delivery";
  schedule_kind: "range" | "daily_window" | "weekly";
  status: OfficialPromotion["status"];
  starts_at: string;
  ends_at: string;
  daily_start: string;
  daily_end: string;
  weekly_days_text: string;
  image_url: string;
  video_url: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const weekly_days = args.weekly_days_text
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n))
    .map((n) => Math.max(0, Math.min(6, Math.floor(n))));

  const starts_at = args.starts_at.trim() ? new Date(args.starts_at).toISOString() : null;
  const ends_at = args.ends_at.trim() ? new Date(args.ends_at).toISOString() : null;

  const payload =
    args.schedule_kind === "range"
      ? {
          title: args.title.trim() || "新促销",
          image_url: args.image_url.trim() || null,
          video_url: args.video_url.trim() || null,
          channel: args.channel,
          schedule_kind: "range" as const,
          starts_at,
          ends_at,
          daily_start: null,
          daily_end: null,
          weekly_days: [],
          status: args.status,
        }
      : args.schedule_kind === "daily_window"
        ? {
            title: args.title.trim() || "新促销",
            image_url: args.image_url.trim() || null,
            video_url: args.video_url.trim() || null,
            channel: args.channel,
            schedule_kind: "daily_window" as const,
            starts_at: null,
            ends_at: null,
            daily_start: args.daily_start.trim() || null,
            daily_end: args.daily_end.trim() || null,
            weekly_days: [],
            status: args.status,
          }
        : {
            title: args.title.trim() || "新促销",
            image_url: args.image_url.trim() || null,
            video_url: args.video_url.trim() || null,
            channel: args.channel,
            schedule_kind: "weekly" as const,
            starts_at: null,
            ends_at: null,
            daily_start: null,
            daily_end: null,
            weekly_days,
            status: args.status,
          };

  const { error } = await supabase.from("official_promotions").update(payload).eq("id", args.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteOfficialPromotion(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { error } = await supabase.from("official_promotions").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchOfficialDispatchRules(): Promise<OfficialDispatchRule[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_dispatch_rules")
    .select("id,name,value,detail,is_active,sort")
    .order("sort", { ascending: true });
  if (error || !data) return [];
  return (data as unknown) as OfficialDispatchRule[];
}

export async function fetchOfficialProfiles(limit = 50): Promise<OfficialProfileRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_profiles")
    .select("id,full_name,phone,email,avatar_url,address,birth_date,role,status,membership_tier,cumulative_spend_myr,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown) as OfficialProfileRow[];
}

export async function fetchOfficialOutlets(): Promise<OfficialOutletRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_outlets")
    .select("id,name,location,operating_hours,is_active")
    .order("name", { ascending: true });
  if (error || !data) return [];
  return (data as unknown) as OfficialOutletRow[];
}

export async function createOfficialOutlet(args: {
  name: string;
  location: string;
  operating_hours: string;
  is_active?: boolean;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { data, error } = await supabase
    .from("official_outlets")
    .insert({
      name: args.name.trim(),
      location: args.location.trim(),
      operating_hours: args.operating_hours.trim(),
      is_active: args.is_active ?? true,
    })
    .select("id")
    .single();
  if (error || !data?.id) return { ok: false, message: error?.message ?? "创建分店失败" };
  return { ok: true, id: data.id as string };
}

export async function updateOfficialOutlet(args: {
  id: string;
  name: string;
  location: string;
  operating_hours: string;
  is_active: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { error } = await supabase
    .from("official_outlets")
    .update({
      name: args.name.trim(),
      location: args.location.trim(),
      operating_hours: args.operating_hours.trim(),
      is_active: args.is_active,
    })
    .eq("id", args.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteOfficialOutlet(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { count, error: merchantCheckError } = await supabase
    .from("official_merchant_accounts")
    .select("id", { count: "exact", head: true })
    .eq("outlet_id", id);
  if (merchantCheckError) return { ok: false, message: merchantCheckError.message };
  if ((count ?? 0) > 0) {
    return { ok: false, message: "该分店仍绑定 Merchant 账号，请先解除绑定或停用相关 Merchant 后再删除。" };
  }
  const { error } = await supabase.from("official_outlets").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchOfficialMerchantAccounts(): Promise<OfficialMerchantAccountRow[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_merchant_accounts")
    .select("id,profile_id,outlet_id,status,official_outlets(name,location)")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data as unknown as OfficialMerchantAccountRow[];
}

export async function upsertOfficialMerchantAccount(args: {
  profile_id: string;
  outlet_id: string;
  status?: OfficialMerchantAccountRow["status"];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { error } = await supabase
    .from("official_merchant_accounts")
    .upsert(
      {
        profile_id: args.profile_id,
        outlet_id: args.outlet_id,
        status: args.status ?? "active",
      },
      { onConflict: "profile_id" },
    );
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function createOfficialProfile(args: {
  full_name: string;
  phone: string;
  email: string;
  avatar_url: string;
  address: string;
  role: OfficialProfileRow["role"];
  status?: OfficialProfileRow["status"];
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const id = crypto.randomUUID();
  const payload = {
    id,
    full_name: args.full_name.trim() || null,
    phone: args.phone.trim() || null,
    email: args.email.trim() || null,
    avatar_url: args.avatar_url.trim() || null,
    address: args.address.trim() || null,
    role: args.role,
    status: args.status ?? "active",
  };
  const { error } = await supabase.from("official_profiles").insert(payload);
  if (error) return { ok: false, message: error.message };
  return { ok: true, id };
}

export async function createOfficialUserAccount(args: {
  full_name: string;
  phone?: string;
  email: string;
  password: string;
  avatar_url?: string;
  address?: string;
  birth_date?: string | null;
  referral_code?: string | null;
  role: OfficialProfileRow["role"];
  outlet_id?: string | null;
  status?: OfficialProfileRow["status"];
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { data, error } = await supabase.functions.invoke("admin-user-create", {
    body: {
      full_name: args.full_name,
      phone: args.phone ?? "",
      email: args.email,
      password: args.password,
      avatar_url: args.avatar_url ?? "",
      address: args.address ?? "",
      birth_date: args.birth_date ?? null,
      referral_code: args.referral_code ?? null,
      role: args.role,
      outlet_id: args.outlet_id ?? null,
      status: args.status ?? "active",
    },
  });
  if (error) {
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const payload = (await context.clone().json()) as { message?: string };
        if (payload?.message) return { ok: false, message: payload.message };
      } catch {
        try {
          const text = await context.clone().text();
          if (text.trim()) return { ok: false, message: text.trim() };
        } catch {
          // ignore and fall back to generic error message
        }
      }
    }
    return { ok: false, message: error.message };
  }
  const id = (data as { data?: { id?: string }; message?: string })?.data?.id;
  if (!id) {
    return { ok: false, message: (data as { message?: string } | null)?.message ?? "创建用户失败" };
  }
  return { ok: true, id };
}

export async function updateOfficialProfileDetail(args: {
  id: string;
  full_name: string;
  phone?: string;
  email?: string;
  avatar_url?: string;
  address?: string;
  birth_date?: string | null;
  role: OfficialProfileRow["role"];
  status: OfficialProfileRow["status"];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const payload: {
    full_name: string | null;
    phone: string | null;
    role: OfficialProfileRow["role"];
    status: OfficialProfileRow["status"];
    email?: string | null;
    avatar_url?: string | null;
    address?: string | null;
    birth_date?: string | null;
  } = {
    full_name: args.full_name.trim() || null,
    role: args.role,
    status: args.status,
  };
  if (typeof args.phone === "string") payload.phone = args.phone.trim() || null;
  if (typeof args.email === "string") payload.email = args.email.trim() || null;
  if (typeof args.avatar_url === "string") payload.avatar_url = args.avatar_url.trim() || null;
  if (typeof args.address === "string") payload.address = args.address.trim() || null;
  if (typeof args.birth_date === "string" || args.birth_date === null) payload.birth_date = args.birth_date || null;
  const { error } = await supabase.from("official_profiles").update(payload).eq("id", args.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function deleteOfficialProfile(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  const { error } = await supabase.from("official_profiles").delete().eq("id", id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function updateOfficialProfileAccess(args: {
  id: string;
  role?: OfficialProfileRow["role"];
  status?: OfficialProfileRow["status"];
}): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!supabase) return { ok: false, message: "Supabase 未初始化" };
  if (!args.id) return { ok: false, message: "缺少用户ID" };
  const payload: Partial<Pick<OfficialProfileRow, "role" | "status">> = {};
  if (args.role) payload.role = args.role;
  if (args.status) payload.status = args.status;
  if (!("role" in payload) && !("status" in payload)) return { ok: false, message: "没有可更新字段" };
  const { error } = await supabase.from("official_profiles").update(payload).eq("id", args.id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function fetchProfileCounts(): Promise<{ customers: number; admins: number; pending: number }> {
  if (!supabase) return { customers: 0, admins: 0, pending: 0 };

  const customers = await supabase
    .from("official_profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "customer")
    .neq("status", "disabled");

  const admins = await supabase
    .from("official_profiles")
    .select("id", { count: "exact", head: true })
    .in("role", ["admin", "super_admin"])
    .neq("status", "disabled");

  const pending = await supabase.from("official_profiles").select("id", { count: "exact", head: true }).eq("status", "pending_review");

  return {
    customers: customers.count ?? 0,
    admins: admins.count ?? 0,
    pending: pending.count ?? 0,
  };
}

export async function fetchOfficialPayments(limit = 50): Promise<OfficialPaymentWithOrder[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("official_payments")
    .select("id,gateway_ref,status,amount,method,provider,created_at,official_orders(id,channel,currency)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as unknown) as OfficialPaymentWithOrder[];
}

export async function fetchPaymentCounts(): Promise<{ succeeded: number; pending: number; failed: number; superseded: number }> {
  if (!supabase) return { succeeded: 0, pending: 0, failed: 0, superseded: 0 };

  const succeeded = await supabase.from("official_payments").select("id", { count: "exact", head: true }).eq("status", "succeeded");
  const pending = await supabase.from("official_payments").select("id", { count: "exact", head: true }).in("status", ["created", "pending"]);
  const failed = await supabase.from("official_payments").select("id", { count: "exact", head: true }).eq("status", "failed");
  const superseded = await supabase.from("official_payments").select("id", { count: "exact", head: true }).eq("status", "superseded");

  return {
    succeeded: succeeded.count ?? 0,
    pending: pending.count ?? 0,
    failed: failed.count ?? 0,
    superseded: superseded.count ?? 0,
  };
}
