"use client";

import QRCode from "qrcode";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MemberShell } from "@/components/member-shell";
import { supabase } from "@/lib/supabase";

type RewardsCardData = {
  pointsBalance: number;
  membershipTier: "none" | "bronze" | "silver" | "gold";
};

type RedeemableTemplate = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: "percent" | "fixed_amount";
  percent_off: number | null;
  amount_off_myr: number | null;
  amount_off_sgd: number | null;
  points_cost: number;
  starts_at: string | null;
  ends_at: string | null;
};

type UserCoupon = {
  id: string;
  coupon_instance_code: string;
  status: "issued" | "redeemed" | "expired" | "revoked";
  issued_reason: "manual_issue" | "points_redeem" | "birthday_auto" | "registration_auto" | "rule_auto";
  issued_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  official_coupon_templates?: {
    code?: string | null;
    title?: string | null;
    discount_type?: "percent" | "fixed_amount" | null;
    percent_off?: number | null;
    amount_off_myr?: number | null;
    amount_off_sgd?: number | null;
  } | null;
};

function couponValueLabel(row: {
  discount_type?: "percent" | "fixed_amount" | null;
  percent_off?: number | null;
  amount_off_myr?: number | null;
  amount_off_sgd?: number | null;
}) {
  if (row.discount_type === "percent") return `${Number(row.percent_off ?? 0).toFixed(0)}% OFF`;
  return `MYR ${Number(row.amount_off_myr ?? 0).toFixed(2)} / SGD ${Number(row.amount_off_sgd ?? 0).toFixed(2)}`;
}

export default function MemberCouponsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [couponQrMap, setCouponQrMap] = useState<Record<string, string>>({});
  const [expandedCouponIds, setExpandedCouponIds] = useState<string[]>([]);
  const [rewardsData, setRewardsData] = useState<RewardsCardData | null>(null);
  const [templates, setTemplates] = useState<RedeemableTemplate[]>([]);
  const [userCoupons, setUserCoupons] = useState<UserCoupon[]>([]);
  const [redeemingTemplateId, setRedeemingTemplateId] = useState<string | null>(null);

  const reload = async () => {
    if (!supabase) {
      setError("Supabase 未初始化");
      setLoading(false);
      return;
    }
    const sessionRes = await supabase.auth.getSession();
    const userId = sessionRes.data.session?.user?.id;
    if (!userId) {
      setError("请先登录后查看会员优惠券");
      setLoading(false);
      return;
    }

    await supabase.rpc("official_run_coupon_auto_issuance_for_user", {
      p_target_user_id: userId,
      p_now: new Date().toISOString(),
    });

    const [rewardsRes, templatesRes, userCouponsRes] = await Promise.all([
      supabase.functions.invoke("member-rewards-card", { body: {} }),
      supabase
        .from("official_coupon_templates")
        .select("id,code,title,description,discount_type,percent_off,amount_off_myr,amount_off_sgd,points_cost,starts_at,ends_at")
        .eq("status", "enabled")
        .eq("is_points_redeemable", true)
        .order("points_cost", { ascending: true }),
      supabase
        .from("official_user_coupons")
        .select("id,coupon_instance_code,status,issued_reason,issued_at,expires_at,redeemed_at,official_coupon_templates(code,title,discount_type,percent_off,amount_off_myr,amount_off_sgd)")
        .eq("user_id", userId)
        .order("issued_at", { ascending: false })
        .limit(300),
    ]);

    if (rewardsRes.error || templatesRes.error || userCouponsRes.error) {
      setError(rewardsRes.error?.message ?? templatesRes.error?.message ?? userCouponsRes.error?.message ?? "加载失败");
      setLoading(false);
      return;
    }

    const rewardsPayload = (rewardsRes.data as { data?: RewardsCardData } | null)?.data ?? null;
    setRewardsData(rewardsPayload);
    setTemplates((templatesRes.data ?? []) as RedeemableTemplate[]);
    setUserCoupons((userCouponsRes.data ?? []) as UserCoupon[]);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const generateQrCodes = async () => {
      if (typeof window === "undefined") return;
      const expandedCoupons = userCoupons.filter(
        (coupon) => expandedCouponIds.includes(coupon.id) && !couponQrMap[coupon.id],
      );
      if (expandedCoupons.length === 0) return;
      const entries = await Promise.all(
        expandedCoupons.map(async (coupon) => {
          const redeemUrl = `${window.location.origin}/merchant/coupons/redeem?coupon=${encodeURIComponent(coupon.coupon_instance_code)}`;
          const dataUrl = await QRCode.toDataURL(redeemUrl, {
            width: 220,
            margin: 1,
            color: {
              dark: "#0f172a",
              light: "#ffffff",
            },
          });
          return [coupon.id, dataUrl] as const;
        }),
      );
      if (!active) return;
      setCouponQrMap((prev) => ({
        ...prev,
        ...Object.fromEntries(entries),
      }));
    };
    void generateQrCodes();
    return () => {
      active = false;
    };
  }, [couponQrMap, expandedCouponIds, userCoupons]);

  const couponStats = useMemo(() => {
    const available = userCoupons.filter((coupon) => coupon.status === "issued").length;
    const redeemed = userCoupons.filter((coupon) => coupon.status === "redeemed").length;
    const expired = userCoupons.filter((coupon) => coupon.status === "expired").length;
    return { available, redeemed, expired };
  }, [userCoupons]);

  return (
    <MemberShell
      activeKey="coupons"
      title="会员优惠券"
      subtitle="查看可兑换优惠券与我的优惠券钱包，使用积分兑换后可在结算时使用。"
      stats={[
        { label: "积分余额", value: rewardsData ? String(Number(rewardsData.pointsBalance).toFixed(0)) : "-" },
        { label: "可用优惠券", value: String(couponStats.available) },
        { label: "已使用", value: String(couponStats.redeemed) },
        { label: "已过期", value: String(couponStats.expired) },
      ]}
    >
      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm dark:border-slate-700 dark:bg-slate-800/60">加载中...</section>
      ) : error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <p>{error}</p>
          <div className="mt-3">
            <Link href="/login" className="rounded-lg border border-primary/40 px-3 py-1.5 font-bold text-primary hover:bg-primary/10">
              去登录
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-primary">REDEEMABLE</p>
                <h2 className="mt-1 text-2xl font-black">可兑换优惠券</h2>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-300">当前积分：{Number(rewardsData?.pointsBalance ?? 0).toFixed(0)}</p>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((template) => {
                const affordable = Number(rewardsData?.pointsBalance ?? 0) >= Number(template.points_cost ?? 0);
                return (
                  <article key={template.id} className="rounded-2xl border border-primary/10 bg-slate-50 p-4 dark:border-primary/20 dark:bg-slate-800/50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black tracking-[0.12em] text-primary">{template.code}</p>
                        <h3 className="mt-1 text-lg font-black">{template.title}</h3>
                      </div>
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{couponValueLabel(template)}</span>
                    </div>
                    {template.description ? <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">{template.description}</p> : null}
                    <div className="mt-4 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs text-slate-500 dark:text-slate-300">兑换所需积分</p>
                        <p className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{Number(template.points_cost ?? 0).toFixed(0)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!affordable || redeemingTemplateId === template.id}
                        onClick={async () => {
                          if (!supabase) return;
                          setRedeemingTemplateId(template.id);
                          const res = await supabase.rpc("official_redeem_points_coupon_template", { p_template_id: template.id });
                          setRedeemingTemplateId(null);
                          if (res.error) {
                            setMessage(res.error.message);
                            return;
                          }
                          const payload = res.data as { ok?: boolean; reason?: string } | null;
                          if (!payload?.ok) {
                            setMessage(payload?.reason === "insufficient_points" ? "积分不足，暂时无法兑换" : "兑换失败");
                            return;
                          }
                          setMessage("兑换成功，优惠券已加入你的钱包");
                          await reload();
                        }}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {redeemingTemplateId === template.id ? "兑换中..." : affordable ? "立即兑换" : "积分不足"}
                      </button>
                    </div>
                  </article>
                );
              })}
              {templates.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-300">当前暂无可兑换优惠券。</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black tracking-[0.16em] text-primary">MY COUPONS</p>
                <h2 className="mt-1 text-2xl font-black">我的优惠券</h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">堂食时请直接出示下方二维码给 Merchant 扫描，或让 Merchant 在核销页输入 Coupon ID。</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {userCoupons.map((coupon) => {
                const isExpanded = expandedCouponIds.includes(coupon.id);
                return (
                  <article key={coupon.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-black tracking-[0.12em] text-primary">{coupon.official_coupon_templates?.code?.trim() || "-"}</p>
                        <h3 className="mt-1 text-lg font-black">{coupon.official_coupon_templates?.title?.trim() || "优惠券"}</h3>
                      </div>
                      <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                        coupon.status === "issued"
                          ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30"
                          : coupon.status === "redeemed"
                            ? "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"
                            : "bg-rose-100 text-rose-600 dark:bg-rose-900/30"
                      }`}>
                        {coupon.status}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-slate-500 dark:text-slate-300">
                      {couponValueLabel(coupon.official_coupon_templates ?? {})}
                    </p>
                    <div className="mt-3 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Coupon ID</p>
                      <p className="mt-1 text-sm font-black tracking-[0.08em] text-slate-900 dark:text-slate-100">{coupon.coupon_instance_code}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCouponIds((prev) =>
                          prev.includes(coupon.id) ? prev.filter((id) => id !== coupon.id) : [...prev, coupon.id],
                        )
                      }
                      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10"
                    >
                      <span>{isExpanded ? "收起详情" : "查看详情"}</span>
                      <span className="material-symbols-outlined text-base">{isExpanded ? "expand_less" : "expand_more"}</span>
                    </button>
                    {isExpanded ? (
                      <>
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900/70">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Dine-In QR</p>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-300">Merchant 扫码后会自动打开堂食核销页并带入这张优惠券。</p>
                            </div>
                            <Link
                              href={`/merchant/coupons/redeem?coupon=${encodeURIComponent(coupon.coupon_instance_code)}`}
                              className="rounded-lg border border-primary/30 px-2 py-1 text-[11px] font-bold text-primary hover:bg-primary/10"
                            >
                              打开核销链接
                            </Link>
                          </div>
                          <div className="mt-3 flex justify-center">
                            {couponQrMap[coupon.id] ? (
                              <Image
                                src={couponQrMap[coupon.id]}
                                alt={`QR for ${coupon.coupon_instance_code}`}
                                width={160}
                                height={160}
                                className="h-40 w-40 rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                                生成二维码中...
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 space-y-1 text-xs text-slate-500 dark:text-slate-300">
                          <p>派发方式：{coupon.issued_reason}</p>
                          <p>获得时间：{new Date(coupon.issued_at).toLocaleString("zh-CN", { hour12: false })}</p>
                          <p>到期时间：{coupon.expires_at ? new Date(coupon.expires_at).toLocaleString("zh-CN", { hour12: false }) : "未设置"}</p>
                        </div>
                      </>
                    ) : null}
                  </article>
                );
              })}
              {userCoupons.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-300">你目前还没有优惠券。</p> : null}
            </div>
          </section>

          {message ? <section className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm font-bold text-primary">{message}</section> : null}
        </>
      )}
    </MemberShell>
  );
}
