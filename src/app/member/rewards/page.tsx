"use client";

import QRCode from "qrcode";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MemberShell } from "@/components/member-shell";
import { assetPath } from "@/lib/site-config";

type RewardsCardData = {
  fullName: string;
  membershipTier: "none" | "bronze" | "silver" | "gold";
  cumulativeSpendMyr: number;
  rewardsCode: string;
  qrPayload: string;
  pointsBalance: number;
  status: "active" | "suspended";
};

function tierLabel(tier: RewardsCardData["membershipTier"]) {
  if (tier === "gold") return "Gold";
  if (tier === "silver") return "Silver";
  if (tier === "bronze") return "Bronze";
  return "New";
}

function tierTitle(tier: RewardsCardData["membershipTier"]) {
  if (tier === "gold") return "NAN PENG YOU GOLD MEMBER";
  if (tier === "silver") return "NAN PENG YOU SILVER MEMBER";
  if (tier === "bronze") return "NAN PENG YOU BRONZE MEMBER";
  return "NAN PENG YOU MEMBER";
}

function normalizeTier(value: string | null | undefined): RewardsCardData["membershipTier"] {
  if (value === "gold" || value === "silver" || value === "bronze") return value;
  return "none";
}

function tierCardClass(tier: RewardsCardData["membershipTier"]) {
  if (tier === "gold") return "from-[#3a2b08] via-[#b38b2f] to-[#f4cc67]";
  if (tier === "silver") return "from-[#2f3745] via-[#768094] to-[#c2c9d6]";
  if (tier === "bronze") return "from-[#3b2215] via-[#92502f] to-[#d98a5a]";
  return "from-[#2b1a11] via-[#733e1d] to-[#d47331]";
}

function statusLabel(status: RewardsCardData["status"]) {
  return status === "active" ? "已激活" : "已停用";
}

function membershipUpgradeProgress(tier: RewardsCardData["membershipTier"], cumulativeSpendMyr: number) {
  const spend = Number(cumulativeSpendMyr || 0);
  if (tier === "gold") {
    return {
      value: "已达最高等级",
      helper: "你当前已是 Gold 会员，已解锁最高返利与会员权益。",
      progress: 100,
      progressLabel: "Gold Member",
    };
  }

  const nextTier = tier === "silver" ? "Gold" : tier === "bronze" ? "Silver" : "Bronze";
  const target = tier === "silver" ? 5000 : tier === "bronze" ? 1000 : 30;
  const base = tier === "silver" ? 1000 : tier === "bronze" ? 30 : 0;
  const progress = ((Math.max(spend, base) - base) / (target - base)) * 100;
  const remaining = Math.max(target - spend, 0);

  return {
    value: `距离 ${nextTier} 还差 RM ${remaining.toFixed(2)}`,
    helper: `当前消费进度 RM ${spend.toFixed(2)}，再消费一点即可升级。`,
    progress: Number.isFinite(progress) ? progress : 0,
    progressLabel: `当前 RM ${spend.toFixed(2)} / 目标 RM ${target.toFixed(0)}`,
  };
}

export default function MemberRewardsCardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RewardsCardData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!supabase) {
        if (!active) return;
        setError("Supabase 未初始化");
        setLoading(false);
        return;
      }
      const sessionRes = await supabase.auth.getSession();
      const userId = sessionRes.data.session?.user?.id;
      if (!userId) {
        if (!active) return;
        setError("请先登录后查看会员卡");
        setLoading(false);
        return;
      }
      const [cardRes, profileRes] = await Promise.all([
        supabase.functions.invoke("member-rewards-card", { body: {} }),
        supabase.from("official_profiles").select("membership_tier").eq("id", userId).maybeSingle(),
      ]);
      if (!active) return;
      if (cardRes.error) {
        setError(cardRes.error.message);
        setLoading(false);
        return;
      }
      const payload = (cardRes.data as { data?: RewardsCardData } | null)?.data ?? null;
      const resolvedTier = normalizeTier((profileRes.data as { membership_tier?: string | null } | null)?.membership_tier ?? payload?.membershipTier ?? "none");
      setData(payload ? { ...payload, membershipTier: resolvedTier } : payload);
      setLoading(false);
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const generateQr = async () => {
      const payload = data?.qrPayload ?? "";
      if (!payload) {
        setQrDataUrl("");
        return;
      }
      const dataUrl = await QRCode.toDataURL(payload, {
        width: 280,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff",
        },
      });
      if (!active) return;
      setQrDataUrl(dataUrl);
    };
    void generateQr();
    return () => {
      active = false;
    };
  }, [data?.qrPayload]);

  const upgradeStat = membershipUpgradeProgress(data?.membershipTier ?? "none", Number(data?.cumulativeSpendMyr ?? 0));

  return (
    <MemberShell
      activeKey="rewards"
      title="会员积分卡"
      subtitle="到店消费时出示二维码或 Rewards Code，审核后自动入账。"
      stats={[
        { label: "会员等级", value: data ? tierLabel(data.membershipTier) : "-" },
        { label: "会员状态", value: data ? statusLabel(data.status) : "-" },
        { label: "积分余额", value: data ? String(Number(data.pointsBalance).toFixed(0)) : "-" },
        { label: "升级进度", value: upgradeStat.value, helper: upgradeStat.helper, progress: upgradeStat.progress, progressLabel: upgradeStat.progressLabel },
      ]}
    >
      {loading ? (
        <section className="rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] p-6 text-sm backdrop-blur-sm dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface-elevated)]">加载中...</section>
      ) : error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 backdrop-blur-sm dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <p>{error}</p>
          <div className="mt-3">
            <Link href="/login" className="rounded-lg border border-primary/40 px-3 py-1.5 font-bold text-primary hover:bg-primary/10">
              去登录
            </Link>
          </div>
        </section>
      ) : data ? (
        <section className="ui-table-root rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-6 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">
          <div className="space-y-4">
            <div className="space-y-4">
              <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${tierCardClass(data.membershipTier)} px-5 py-4 text-white shadow-2xl shadow-orange-500/20 sm:px-6 sm:py-5`}>
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl sm:h-40 sm:w-40" />
                <div className="absolute -bottom-14 left-8 h-24 w-24 rounded-full bg-amber-200/20 blur-2xl sm:left-10 sm:h-32 sm:w-32" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-black tracking-[0.14em] text-white/80">{tierTitle(data.membershipTier)}</p>
                      <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.15em] text-white/70">Card Holder</p>
                      <p className="mt-1 text-lg font-black uppercase sm:text-xl">{(data.fullName || "Member").toUpperCase()}</p>
                      <div className="mt-3">
                        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">Rewards Code</p>
                        <p className="mt-1 text-lg font-black tracking-[0.12em] sm:text-xl">{data.rewardsCode}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end justify-start self-start">
                      <Image src={assetPath("/logo.png")} alt="NPY Logo" width={170} height={56} className="h-auto w-[120px] object-contain sm:w-[170px]" />
                    </div>
                  </div>
                  <div className="mt-4 flex items-end justify-between gap-3">
                    <p className="max-w-[210px] text-[11px] leading-relaxed text-white/90 sm:max-w-[260px] sm:text-xs">到店时直接出示本卡片二维码或 Rewards Code，店员扫码后进入积分审核流程。</p>
                    <div className="rounded-xl bg-white/95 p-1.5 sm:p-2">
                      {qrDataUrl ? (
                        <Image src={qrDataUrl} alt="Member Rewards QR" width={120} height={120} className="h-[92px] w-[92px] sm:h-[120px] sm:w-[120px]" unoptimized />
                      ) : (
                        <p className="text-xs text-slate-500">暂无二维码</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>
      ) : null}
    </MemberShell>
  );
}
