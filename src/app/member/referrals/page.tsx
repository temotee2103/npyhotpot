"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MemberShell } from "@/components/member-shell";
import { siteConfig } from "@/lib/site-config";
import { supabase } from "@/lib/supabase";

type ReferralProfile = {
  id: string;
  full_name: string | null;
  membership_tier: "none" | "bronze" | "silver" | "gold" | null;
};

function tierLabel(value: ReferralProfile["membership_tier"]) {
  if (value === "gold") return "Gold";
  if (value === "silver") return "Silver";
  if (value === "bronze") return "Bronze";
  return "New";
}

export default function MemberReferralsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ReferralProfile | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [siteUrl, setSiteUrl] = useState(siteConfig.url);

  useEffect(() => {
    setSiteUrl(`${window.location.origin}${siteConfig.basePath}`);
  }, []);

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
        setError("请先登录后使用推荐功能");
        setLoading(false);
        return;
      }
      const profileRes = await supabase
        .from("official_profiles")
        .select("id,full_name,membership_tier")
        .eq("id", userId)
        .maybeSingle();
      if (!active) return;
      if (profileRes.error || !profileRes.data) {
        setError(profileRes.error?.message ?? "加载推荐资料失败");
        setLoading(false);
        return;
      }
      setProfile(profileRes.data as ReferralProfile);
      setLoading(false);
    };
    void run();
    return () => {
      active = false;
    };
  }, []);

  const referralCode = profile?.id ? `NPY${profile.id.replace(/-/g, "").slice(0, 8).toUpperCase()}` : "";

  const referralLink = useMemo(() => {
    if (!referralCode) return "";
    return `${siteUrl}/register?ref=${encodeURIComponent(referralCode)}`;
  }, [referralCode, siteUrl]);

  const shareText = useMemo(() => {
    return `我在男朋友火锅，推荐你注册会员一起累计积分！使用我的推荐码：${referralCode}\n${referralLink}`;
  }, [referralCode, referralLink]);

  const onCopy = async (text: string, copiedMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(copiedMessage);
    } catch {
      setMessage("复制失败，请手动复制。");
    }
  };

  const openWhatsapp = async () => {
    await onCopy(shareText, "推荐文案已复制，可直接发送给好友。");
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank", "noopener,noreferrer");
  };

  const openInstagram = async () => {
    await onCopy(shareText, "推荐文案已复制，请到 Instagram 粘贴发布。");
    window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
  };

  return (
    <MemberShell
      activeKey="referrals"
      title="推荐有礼"
      subtitle="分享你的专属推荐链接，好友消费后你可获得直属推荐返利积分。"
      stats={[
        { label: "会员等级", value: tierLabel(profile?.membership_tier ?? null) },
        { label: "推荐码", value: referralCode || "-" },
      ]}
    >
      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-700 dark:bg-slate-900/70">加载中...</section>
      ) : error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <p>{error}</p>
          <Link href="/login" className="mt-3 inline-flex rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10">
            去登录
          </Link>
        </section>
      ) : (
        <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <p className="text-xs font-black tracking-[0.14em] text-primary">REFERRAL LINK</p>
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-xs text-slate-500 dark:text-slate-300">专属推荐码</p>
            <p className="mt-1 text-lg font-black text-slate-900 dark:text-slate-100">{referralCode}</p>
            <p className="mt-3 break-all text-sm text-slate-600 dark:text-slate-300">{referralLink}</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <button type="button" onClick={() => void onCopy(referralLink, "推荐链接已复制")} className="rounded-xl border border-primary/30 px-3 py-2 text-sm font-black text-primary hover:bg-primary/10">
              一键复制链接
            </button>
            <button type="button" onClick={openWhatsapp} className="rounded-xl border border-emerald-300 px-3 py-2 text-sm font-black text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
              WhatsApp 分享
            </button>
            <button type="button" onClick={openInstagram} className="rounded-xl border border-fuchsia-300 px-3 py-2 text-sm font-black text-fuchsia-600 hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20">
              IG 分享
            </button>
          </div>
          {message ? <p className="mt-3 text-xs font-bold text-primary">{message}</p> : null}
          <div className="bullet-note mt-5">
            <p className="bullet-note__title">返利规则</p>
            <ul className="bullet-note__list">
              <li>你每消费 <strong>RM1</strong>，可累计 <strong>1</strong> 积分。</li>
              <li>直属推荐用户消费后，你会按当前会员等级获得返利积分。</li>
            </ul>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-[#d98a5a]/30 bg-gradient-to-br from-[#3b2215] via-[#92502f] to-[#d98a5a] p-4 text-white shadow-lg shadow-[#92502f]/20">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">Bronze</p>
              <p className="mt-2 text-3xl font-black">25%</p>
              <p className="mt-2 text-xs leading-relaxed text-white/80">直属推荐用户消费后，你可获得 Bronze 档返利积分。</p>
            </div>
            <div className="rounded-2xl border border-[#c2c9d6]/35 bg-gradient-to-br from-[#2f3745] via-[#768094] to-[#c2c9d6] p-4 text-white shadow-lg shadow-slate-500/20">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">Silver</p>
              <p className="mt-2 text-3xl font-black">50%</p>
              <p className="mt-2 text-xs leading-relaxed text-white/85">升级到 Silver 后，直属推荐返利比例会进一步提升。</p>
            </div>
            <div className="rounded-2xl border border-[#f4cc67]/35 bg-gradient-to-br from-[#3a2b08] via-[#b38b2f] to-[#f4cc67] p-4 text-white shadow-lg shadow-amber-500/20">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/75">Gold</p>
              <p className="mt-2 text-3xl font-black">75%</p>
              <p className="mt-2 text-xs leading-relaxed text-white/85">Gold 会员享有最高直属推荐返利比例与更完整的会员权益。</p>
            </div>
          </div>
        </section>
      )}
    </MemberShell>
  );
}
