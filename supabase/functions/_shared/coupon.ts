type SupabaseClientLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (field: string, value: unknown) => {
        maybeSingle: () => Promise<{ error?: unknown; data?: unknown }>;
      };
    };
    update: (payload: Record<string, unknown>) => {
      eq: (field: string, value: unknown) => {
        eq: (field: string, value: unknown) => Promise<unknown>;
        is: (field: string, value: null) => {
          is: (field: string, value: null) => {
            select: (columns: string) => {
              maybeSingle: () => Promise<{ error?: unknown; data?: unknown }>;
            };
          };
        };
      };
    };
  };
};

type CouponTemplateRecord = {
  id: string;
  code: string;
  title: string;
  discount_type: "percent" | "fixed_amount";
  percent_off: number | null;
  amount_off_myr: number | null;
  amount_off_sgd: number | null;
  min_spend_myr: number | null;
  min_spend_sgd: number | null;
  status: "enabled" | "disabled";
  starts_at: string | null;
  ends_at: string | null;
  applies_channels: string[] | null;
  stackable: boolean | null;
};

export type CouponRecord = {
  id: string;
  user_id: string;
  template_id: string;
  coupon_instance_code: string;
  meta?: Record<string, unknown> | null;
  status: "issued" | "redeemed" | "expired" | "revoked";
  expires_at: string | null;
  redeemed_at: string | null;
  revoked_at: string | null;
  reserved_order_id: string | null;
  reserved_at: string | null;
  official_coupon_templates?: CouponTemplateRecord | null;
};

export type CouponValidationResult =
  | {
      ok: true;
      coupon: CouponRecord;
      template: CouponTemplateRecord;
      discountAmount: number;
      currency: "MYR" | "SGD";
      channel: "shop" | "delivery" | "dine_in";
    }
  | {
      ok: false;
      reason:
        | "missing_coupon_code"
        | "coupon_not_found"
        | "coupon_not_owned"
        | "coupon_not_active"
        | "coupon_expired"
        | "coupon_already_used"
        | "coupon_reserved"
        | "template_not_available"
        | "channel_not_allowed"
        | "min_spend_not_met"
        | "invalid_subtotal";
      message: string;
    };

export type CouponApplyResult =
  | {
      ok: true;
      appliedCoupons: Array<{
        coupon: CouponRecord;
        template: CouponTemplateRecord;
        discountAmount: number;
      }>;
      totalDiscount: number;
      couponIds: string[];
      couponCodes: string[];
      primaryCouponId: string | null;
      primaryCouponCode: string | null;
    }
  | {
      ok: false;
      reason: "not_authenticated" | "coupon_not_found" | "coupon_not_stackable";
      message: string;
    }
  | CouponValidationResult;

export async function fetchCouponByCode(supabase: SupabaseClientLike, couponCode: string): Promise<CouponRecord | null> {
  const normalizedCode = couponCode.trim().toUpperCase();
  if (!normalizedCode) return null;
  const result = await supabase
    .from("official_user_coupons")
    .select(
      "id,user_id,template_id,coupon_instance_code,meta,status,expires_at,redeemed_at,revoked_at,reserved_order_id,reserved_at,official_coupon_templates(id,code,title,discount_type,percent_off,amount_off_myr,amount_off_sgd,min_spend_myr,min_spend_sgd,status,starts_at,ends_at,applies_channels,stackable)",
    )
    .eq("coupon_instance_code", normalizedCode)
    .maybeSingle();
  if (result.error || !result.data) return null;
  return result.data as CouponRecord;
}

export function normalizeCouponCodes(input: string[] = []) {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const raw of input) {
    const code = raw.trim().toUpperCase();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    output.push(code);
  }
  return output;
}

export function validateCouponForUse({
  coupon,
  userId,
  channel,
  currency,
  subtotal,
  nowIso,
  allowAnyOwner = false,
  allowedReservedOrderId = null,
}: {
  coupon: CouponRecord | null;
  userId?: string | null;
  channel: "shop" | "delivery" | "dine_in";
  currency: "MYR" | "SGD";
  subtotal: number;
  nowIso?: string;
  allowAnyOwner?: boolean;
  allowedReservedOrderId?: string | null;
}): CouponValidationResult {
  if (!coupon) {
    return { ok: false, reason: "coupon_not_found", message: "优惠券不存在" };
  }
  if (!allowAnyOwner && userId && coupon.user_id !== userId) {
    return { ok: false, reason: "coupon_not_owned", message: "这张优惠券不属于当前用户" };
  }
  if (!Number.isFinite(subtotal) || subtotal <= 0) {
    return { ok: false, reason: "invalid_subtotal", message: "订单金额无效，无法使用优惠券" };
  }

  const now = new Date(nowIso ?? new Date().toISOString());
  if (coupon.status !== "issued") {
    return { ok: false, reason: "coupon_not_active", message: "优惠券当前不可使用" };
  }
  if (coupon.redeemed_at) {
    return { ok: false, reason: "coupon_already_used", message: "优惠券已被使用" };
  }
  if (coupon.revoked_at) {
    return { ok: false, reason: "coupon_not_active", message: "优惠券已失效" };
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < now.getTime()) {
    return { ok: false, reason: "coupon_expired", message: "优惠券已过期" };
  }
  if (coupon.reserved_order_id && coupon.reserved_order_id !== allowedReservedOrderId) {
    return { ok: false, reason: "coupon_reserved", message: "优惠券正在被另一笔订单使用" };
  }

  const template = coupon.official_coupon_templates;
  if (!template || template.status !== "enabled") {
    return { ok: false, reason: "template_not_available", message: "优惠券模板当前不可用" };
  }
  if (template.starts_at && new Date(template.starts_at).getTime() > now.getTime()) {
    return { ok: false, reason: "template_not_available", message: "优惠券尚未生效" };
  }
  if (template.ends_at && new Date(template.ends_at).getTime() < now.getTime()) {
    return { ok: false, reason: "template_not_available", message: "优惠券模板已过期" };
  }

  const channels = (template.applies_channels ?? []).map((item) => item.trim()).filter(Boolean);
  if (channels.length > 0 && !channels.includes(channel)) {
    return { ok: false, reason: "channel_not_allowed", message: "该优惠券不可用于当前渠道" };
  }

  const minSpend = Number(currency === "SGD" ? template.min_spend_sgd ?? 0 : template.min_spend_myr ?? 0);
  if (subtotal < minSpend) {
    return {
      ok: false,
      reason: "min_spend_not_met",
      message: `订单金额未达到最低使用门槛 ${currency} ${minSpend.toFixed(2)}`,
    };
  }

  let discountAmount = 0;
  if (template.discount_type === "percent") {
    discountAmount = subtotal * (Number(template.percent_off ?? 0) / 100);
  } else {
    discountAmount = Number(currency === "SGD" ? template.amount_off_sgd ?? 0 : template.amount_off_myr ?? 0);
  }
  discountAmount = Math.max(0, Math.min(subtotal, Number(discountAmount.toFixed(2))));

  return {
    ok: true,
    coupon,
    template,
    discountAmount,
    currency,
    channel,
  };
}

export async function reserveCouponForOrder(supabase: SupabaseClientLike, couponId: string, orderId: string) {
  const result = await supabase
    .from("official_user_coupons")
    .update({
      reserved_order_id: orderId,
      reserved_at: new Date().toISOString(),
    })
    .eq("id", couponId)
    .is("redeemed_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  return !(result.error || !result.data);
}

export async function reserveCouponsForOrder(supabase: SupabaseClientLike, couponIds: string[], orderId: string) {
  const reservedIds: string[] = [];
  for (const couponId of couponIds) {
    const ok = await reserveCouponForOrder(supabase, couponId, orderId);
    if (!ok) {
      for (const id of reservedIds) await releaseCouponReservation(supabase, id, orderId);
      return false;
    }
    reservedIds.push(couponId);
  }
  return true;
}

export async function releaseCouponReservation(supabase: SupabaseClientLike, couponId: string, orderId?: string | null) {
  let query = supabase
    .from("official_user_coupons")
    .update({
      reserved_order_id: null,
      reserved_at: null,
    })
    .eq("id", couponId);
  if (orderId) query = query.eq("reserved_order_id", orderId);
  await query;
}

export async function releaseCouponReservations(supabase: SupabaseClientLike, couponIds: string[] = [], orderId?: string | null) {
  for (const couponId of couponIds) {
    await releaseCouponReservation(supabase, couponId, orderId);
  }
}

export async function markCouponRedeemed(
  supabase: SupabaseClientLike,
  {
    couponId,
    channel,
    orderId,
    redeemedBy,
    outletId,
  }: {
    couponId: string;
    channel: "shop" | "delivery" | "dine_in";
    orderId?: string | null;
    redeemedBy?: string | null;
    outletId?: string | null;
  },
) {
  await supabase
    .from("official_user_coupons")
    .update({
      status: "redeemed",
      redeemed_at: new Date().toISOString(),
      redeemed_channel: channel,
      redeemed_order_id: orderId ?? null,
      redeemed_by: redeemedBy ?? null,
      redeemed_outlet_id: outletId ?? null,
      reserved_order_id: null,
      reserved_at: null,
    })
    .eq("id", couponId);
}

export async function markCouponsRedeemed(
  supabase: SupabaseClientLike,
  {
    couponIds,
    channel,
    orderId,
    redeemedBy,
    outletId,
  }: {
    couponIds: string[];
    channel: "shop" | "delivery" | "dine_in";
    orderId?: string | null;
    redeemedBy?: string | null;
    outletId?: string | null;
  },
) {
  for (const couponId of couponIds) {
    await markCouponRedeemed(supabase, { couponId, channel, orderId, redeemedBy, outletId });
  }
}

export async function applyCouponsForCheckout({
  supabase,
  couponCodes,
  userId,
  channel,
  currency,
  subtotal,
}: {
  supabase: SupabaseClientLike;
  couponCodes: string[];
  userId?: string | null;
  channel: "shop" | "delivery" | "dine_in";
  currency: "MYR" | "SGD";
  subtotal: number;
}): Promise<CouponApplyResult> {
  const normalizedCodes = normalizeCouponCodes(couponCodes);
  if (normalizedCodes.length === 0) {
    return {
      ok: true,
      appliedCoupons: [],
      totalDiscount: 0,
      couponIds: [],
      couponCodes: [],
      primaryCouponId: null,
      primaryCouponCode: null,
    };
  }
  if (!userId && channel !== "dine_in") {
    return { ok: false, reason: "not_authenticated", message: "请先登录后再使用会员优惠券" };
  }

  const validated: Array<{ coupon: CouponRecord; template: CouponTemplateRecord }> = [];
  for (const couponCode of normalizedCodes) {
    const coupon = await fetchCouponByCode(supabase, couponCode);
    const result = validateCouponForUse({
      coupon,
      userId,
      channel,
      currency,
      subtotal,
      allowAnyOwner: channel === "dine_in",
    });
    if (!result.ok) return result;
    validated.push({ coupon: result.coupon, template: result.template });
  }

  if (validated.length > 1 && validated.some((item) => !item.template.stackable)) {
    return {
      ok: false,
      reason: "coupon_not_stackable",
      message: "已选择不可叠加优惠券，不能与其他优惠券同时使用",
    };
  }

  let remainingSubtotal = subtotal;
  let totalDiscount = 0;
  const appliedCoupons: Array<{ coupon: CouponRecord; template: CouponTemplateRecord; discountAmount: number }> = [];
  for (const item of validated) {
    let discountAmount = 0;
    if (item.template.discount_type === "percent") {
      discountAmount = remainingSubtotal * (Number(item.template.percent_off ?? 0) / 100);
    } else {
      discountAmount = Number(currency === "SGD" ? item.template.amount_off_sgd ?? 0 : item.template.amount_off_myr ?? 0);
    }
    discountAmount = Math.max(0, Math.min(remainingSubtotal, Number(discountAmount.toFixed(2))));
    remainingSubtotal = Math.max(0, Number((remainingSubtotal - discountAmount).toFixed(2)));
    totalDiscount = Number((totalDiscount + discountAmount).toFixed(2));
    appliedCoupons.push({
      coupon: item.coupon,
      template: item.template,
      discountAmount,
    });
  }

  return {
    ok: true,
    appliedCoupons,
    totalDiscount,
    couponIds: appliedCoupons.map((item) => item.coupon.id),
    couponCodes: appliedCoupons.map((item) => item.coupon.coupon_instance_code),
    primaryCouponId: appliedCoupons[0]?.coupon.id ?? null,
    primaryCouponCode: appliedCoupons[0]?.coupon.coupon_instance_code ?? null,
  };
}
