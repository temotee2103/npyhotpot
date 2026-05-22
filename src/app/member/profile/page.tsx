"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { MemberShell } from "@/components/member-shell";
import { AdminFilePicker } from "@/components/admin-file-picker";
import { UnifiedModal } from "@/components/unified-modal";
import { getProfileCompletionMissingFields, isProfileComplete, parseStoredAddressParts, requiredProfileCompletionFields } from "@/lib/profile-completion";
import { isValidAddress } from "@/lib/validators/address";
import { isValidE164Phone, normalizePhoneToE164 } from "@/lib/validators/phone";

type ProfileData = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  address: string | null;
  avatar_url: string | null;
  membership_tier: "none" | "bronze" | "silver" | "gold" | null;
  cumulative_spend_myr: number | null;
};

type RewardsSummary = {
  membershipTier: "none" | "bronze" | "silver" | "gold";
  pointsBalance: number;
  status: "active" | "suspended";
  cumulativeSpendMyr: number;
};

type AddressParts = ReturnType<typeof parseStoredAddressParts>;

function composeAddressParts(parts: AddressParts): string {
  return [parts.address1, parts.address2, parts.postalCode, parts.state, parts.country].map((item) => item.trim()).join(" | ");
}

function inferStateCountryByPostal(postalCode: string): { state: string; country: string } | null {
  const compact = postalCode.trim().toUpperCase();
  if (!compact) return null;
  if (/^\d{6}$/.test(compact)) return { state: "", country: "Singapore" };
  if (/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/.test(compact)) return { state: "", country: "United Kingdom" };
  const normalized = compact.replace(/\D/g, "");
  if (/^\d{5}$/.test(normalized)) {
    const prefix = Number(normalized.slice(0, 2));
    if (prefix >= 0 && prefix <= 2) return { state: "Perlis", country: "Malaysia" };
    if (prefix >= 5 && prefix <= 9) return { state: "Kedah", country: "Malaysia" };
    if (prefix >= 10 && prefix <= 14) return { state: "Kelantan", country: "Malaysia" };
    if (prefix >= 15 && prefix <= 18) return { state: "Terengganu", country: "Malaysia" };
    if (prefix >= 20 && prefix <= 24) return { state: "Pahang", country: "Malaysia" };
    if (prefix >= 25 && prefix <= 28) return { state: "Johor", country: "Malaysia" };
    if (prefix >= 30 && prefix <= 36) return { state: "Perak", country: "Malaysia" };
    if (prefix >= 40 && prefix <= 48) return { state: "Selangor", country: "Malaysia" };
    if (prefix >= 50 && prefix <= 60) return { state: "Kuala Lumpur", country: "Malaysia" };
    if (prefix >= 62 && prefix <= 64) return { state: "Putrajaya", country: "Malaysia" };
    if (prefix >= 70 && prefix <= 73) return { state: "Negeri Sembilan", country: "Malaysia" };
    if (prefix >= 75 && prefix <= 78) return { state: "Melaka", country: "Malaysia" };
    if (prefix >= 79 && prefix <= 86) return { state: "Johor", country: "Malaysia" };
    if (prefix >= 87 && prefix <= 91) return { state: "Sabah", country: "Malaysia" };
    if (prefix >= 93 && prefix <= 98) return { state: "Sarawak", country: "Malaysia" };
    return { state: "", country: "Malaysia" };
  }
  if (/^\d{5}(-\d{4})?$/.test(compact)) return { state: "", country: "United States" };
  if (normalized.length < 2) return null;
  const prefix = Number(normalized.slice(0, 2));
  if (Number.isNaN(prefix)) return null;
  if (prefix >= 0 && prefix <= 2) return { state: "Perlis", country: "Malaysia" };
  if (prefix >= 5 && prefix <= 9) return { state: "Kedah", country: "Malaysia" };
  if (prefix >= 10 && prefix <= 14) return { state: "Kelantan", country: "Malaysia" };
  if (prefix >= 15 && prefix <= 18) return { state: "Terengganu", country: "Malaysia" };
  if (prefix >= 20 && prefix <= 24) return { state: "Pahang", country: "Malaysia" };
  if (prefix >= 25 && prefix <= 28) return { state: "Johor", country: "Malaysia" };
  if (prefix >= 30 && prefix <= 36) return { state: "Perak", country: "Malaysia" };
  if (prefix >= 40 && prefix <= 48) return { state: "Selangor", country: "Malaysia" };
  if (prefix >= 50 && prefix <= 60) return { state: "Kuala Lumpur", country: "Malaysia" };
  if (prefix >= 62 && prefix <= 64) return { state: "Putrajaya", country: "Malaysia" };
  if (prefix >= 70 && prefix <= 73) return { state: "Negeri Sembilan", country: "Malaysia" };
  if (prefix >= 75 && prefix <= 78) return { state: "Melaka", country: "Malaysia" };
  if (prefix >= 79 && prefix <= 86) return { state: "Johor", country: "Malaysia" };
  if (prefix >= 87 && prefix <= 91) return { state: "Sabah", country: "Malaysia" };
  if (prefix >= 93 && prefix <= 98) return { state: "Sarawak", country: "Malaysia" };
  return null;
}

function rewardsTierLabel(value: RewardsSummary["membershipTier"] | ProfileData["membership_tier"] | null | undefined) {
  if (value === "gold") return "Gold";
  if (value === "silver") return "Silver";
  if (value === "bronze") return "Bronze";
  return "New";
}

function rewardsStatusLabel(value: RewardsSummary["status"] | null | undefined) {
  if (value === "active") return "已激活";
  if (value === "suspended") return "已停用";
  return "-";
}

function membershipUpgradeProgress(
  tier: RewardsSummary["membershipTier"] | ProfileData["membership_tier"] | null | undefined,
  cumulativeSpendMyr: number,
) {
  const normalizedTier = tier === "gold" || tier === "silver" || tier === "bronze" ? tier : "none";
  const spend = Number(cumulativeSpendMyr || 0);

  if (normalizedTier === "gold") {
    return {
      value: "已达最高等级",
      helper: "你当前已是 Gold 会员，已解锁最高返利与会员权益。",
      progress: 100,
      progressLabel: "Gold Member",
    };
  }

  const nextTier = normalizedTier === "silver" ? "Gold" : normalizedTier === "bronze" ? "Silver" : "Bronze";
  const target = normalizedTier === "silver" ? 5000 : normalizedTier === "bronze" ? 1000 : 30;
  const base = normalizedTier === "silver" ? 1000 : normalizedTier === "bronze" ? 30 : 0;
  const progress = ((Math.max(spend, base) - base) / (target - base)) * 100;
  const remaining = Math.max(target - spend, 0);

  return {
    value: `距离 ${nextTier} 还差 RM ${remaining.toFixed(2)}`,
    helper: `当前消费进度 RM ${spend.toFixed(2)}，再消费一点即可升级。`,
    progress: Number.isFinite(progress) ? progress : 0,
    progressLabel: `当前 RM ${spend.toFixed(2)} / 目标 RM ${target.toFixed(0)}`,
  };
}

function MemberProfilePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [rewardsSummary, setRewardsSummary] = useState<RewardsSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editAddress1, setEditAddress1] = useState("");
  const [editAddress2, setEditAddress2] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editState, setEditState] = useState("");
  const [editCountry, setEditCountry] = useState("Malaysia");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const onboardingMode = searchParams.get("onboarding") === "1";
  const welcomeMode = searchParams.get("welcome") === "1";
  const nextPath = (() => {
    const next = searchParams.get("next");
    if (!next) return "/";
    try {
      const decoded = decodeURIComponent(next);
      return decoded.startsWith("/") ? decoded : "/";
    } catch {
      return "/";
    }
  })();
  const missingFields = getProfileCompletionMissingFields(profile);
  const requiredFieldCount = requiredProfileCompletionFields.length;
  const completedRequiredFields = Math.max(requiredFieldCount - missingFields.length, 0);
  const completionPercent = Math.max(0, Math.min(100, Math.round((completedRequiredFields / requiredFieldCount) * 100)));
  const upgradeStat = membershipUpgradeProgress(
    rewardsSummary?.membershipTier ?? profile?.membership_tier,
    Number(rewardsSummary?.cumulativeSpendMyr ?? profile?.cumulative_spend_myr ?? 0),
  );
  const missingFieldLabels: Record<string, string> = {
    phone: "手机号",
  };

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
        setError("请先登录后查看个人信息");
        setLoading(false);
        return;
      }
      const [profileRes, cardRes] = await Promise.all([
        supabase
          .from("official_profiles")
          .select("id,full_name,phone,email,birth_date,address,avatar_url,membership_tier,cumulative_spend_myr")
          .eq("id", userId)
          .maybeSingle(),
        supabase.functions.invoke("member-rewards-card", { body: {} }),
      ]);
      if (!active) return;
      if (profileRes.error) {
        setError(profileRes.error.message);
      }
      const row = (profileRes.data as ProfileData | null) ?? null;
      const payload = !cardRes.error ? ((cardRes.data as { data?: RewardsSummary } | null)?.data ?? null) : null;
      const fallbackSummary: RewardsSummary = {
        membershipTier:
          row?.membership_tier === "gold" || row?.membership_tier === "silver" || row?.membership_tier === "bronze"
            ? row.membership_tier
            : "none",
        pointsBalance: 0,
        status: "active",
        cumulativeSpendMyr: Number(row?.cumulative_spend_myr ?? 0),
      };
      setRewardsSummary(payload ?? fallbackSummary);
      setProfile(row);
      setEditName(row?.full_name ?? "");
      setEditPhone(row?.phone ?? "");
      setEditEmail(row?.email ?? "");
      const addressParts = parseStoredAddressParts(row?.address ?? "");
      setEditAddress1(addressParts.address1);
      setEditAddress2(addressParts.address2);
      setEditPostalCode(addressParts.postalCode);
      setEditState(addressParts.state);
      setEditCountry(addressParts.country || "Malaysia");
      setEditBirthDate(row?.birth_date ?? "");
      setEditAvatarUrl(row?.avatar_url ?? "");
      if ((onboardingMode || welcomeMode || !isProfileComplete(row)) && row) {
        setEditOpen(true);
      }
      setLoading(false);
    };
    void run();
    return () => {
      active = false;
    };
  }, [onboardingMode, welcomeMode]);

  const onSave = async () => {
    if (!supabase || !profile?.id) return;
    setMessage(null);
    const normalizedPhone = normalizePhoneToE164(editPhone);
    if (!isValidE164Phone(normalizedPhone)) {
      setMessage("手机号格式不正确，请使用 +6012xxxxxxx");
      return;
    }
    if (editEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail.trim())) {
      setMessage("邮箱格式不正确");
      return;
    }
    const mergedAddress = composeAddressParts({
      address1: editAddress1,
      address2: editAddress2,
      postalCode: editPostalCode,
      state: editState,
      country: editCountry,
    });
    const hasAnyAddressInput = [editAddress1, editAddress2, editPostalCode, editState]
      .some((value) => value.trim().length > 0);
    if (hasAnyAddressInput && !editAddress1.trim()) {
      setMessage("如需填写地址，Address 1 不能为空");
      return;
    }
    if (hasAnyAddressInput && editPostalCode.trim() && editPostalCode.trim().length < 3) {
      setMessage("Postal Code 不正确");
      return;
    }
    if (hasAnyAddressInput && !isValidAddress(mergedAddress)) {
      setMessage("地址长度需在 10~200 字符");
      return;
    }
    setSaving(true);
    const currentEmail = (profile.email ?? "").trim();
    const newEmail = editEmail.trim();
    const emailChanged = newEmail !== currentEmail;
    const uniqueEmailMessage = "该邮箱已被使用，请更换其他邮箱";
    const uniquePhoneMessage = "该手机号已被使用，请更换其他手机号";
    const isUniqueError = (value: unknown) => {
      const maybe = value as { code?: string; message?: string; details?: string; status?: number } | null | undefined;
      const message = `${maybe?.message ?? ""} ${maybe?.details ?? ""}`.toLowerCase();
      return maybe?.code === "23505" || /duplicate key|unique constraint|already (registered|in use)/i.test(message);
    };
    const uniqueErrorMessage = (value: unknown) => {
      const maybe = value as { message?: string; details?: string } | null | undefined;
      const haystack = `${maybe?.details ?? ""} ${maybe?.message ?? ""}`.toLowerCase();
      if (haystack.includes("phone")) return uniquePhoneMessage;
      if (haystack.includes("email")) return uniqueEmailMessage;
      return "资料已存在重复数据，请检查后重试";
    };
    const basePayload = {
      full_name: editName.trim() || null,
      phone: normalizedPhone,
      birth_date: editBirthDate || null,
      address: mergedAddress.trim() || null,
      avatar_url: editAvatarUrl.trim() || null,
    };
    const { error: updateError } = await supabase
      .from("official_profiles")
      .update(basePayload)
      .eq("id", profile.id);
    if (updateError) {
      setSaving(false);
      setMessage(isUniqueError(updateError) ? uniqueErrorMessage(updateError) : updateError.message);
      return;
    }
    let emailToSave: string | null = currentEmail ? currentEmail : null;
    let emailUpdateErrorMessage: string | null = null;
    if (emailChanged) {
      if (currentEmail && !newEmail) {
        emailUpdateErrorMessage = "邮箱不能为空，已忽略邮箱修改";
        setEditEmail(currentEmail);
      } else if (newEmail) {
        const { data: existingEmailRows, error: emailCheckError } = await supabase
          .from("official_profiles")
          .select("id")
          .eq("email", newEmail)
          .neq("id", profile.id)
          .limit(1);
        if (emailCheckError) {
          emailUpdateErrorMessage = emailCheckError.message;
        } else if (Array.isArray(existingEmailRows) && existingEmailRows.length > 0) {
          emailUpdateErrorMessage = uniqueEmailMessage;
        } else {
          const { error: authError } = await supabase.auth.updateUser({ email: newEmail });
          if (authError) {
            emailUpdateErrorMessage = isUniqueError(authError) ? uniqueEmailMessage : authError.message;
          } else {
            const { error: emailDbError } = await supabase.from("official_profiles").update({ email: newEmail }).eq("id", profile.id);
            if (emailDbError) {
              emailUpdateErrorMessage = isUniqueError(emailDbError) ? uniqueEmailMessage : emailDbError.message;
            } else {
              emailToSave = newEmail;
            }
          }
        }
      }
    }
    setSaving(false);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            ...basePayload,
            email: emailToSave,
          }
        : prev,
    );
    if (emailUpdateErrorMessage) {
      setMessage(emailUpdateErrorMessage);
      return;
    }
    setMessage("个人信息已更新");
    setEditOpen(false);
    const completedProfile = {
      ...basePayload,
      email: emailToSave,
    };
    if (isProfileComplete(completedProfile) && onboardingMode) {
      router.replace(nextPath);
    }
  };

  const openEditModal = () => {
    setMessage(null);
    setEditName(profile?.full_name ?? "");
    setEditPhone(profile?.phone ?? "");
    setEditEmail(profile?.email ?? "");
    const addressParts = parseStoredAddressParts(profile?.address ?? "");
    setEditAddress1(addressParts.address1);
    setEditAddress2(addressParts.address2);
    setEditPostalCode(addressParts.postalCode);
    setEditState(addressParts.state);
    setEditCountry(addressParts.country || "Malaysia");
    setEditBirthDate(profile?.birth_date ?? "");
    setEditAvatarUrl(profile?.avatar_url ?? "");
    setEditOpen(true);
  };

  return (
    <MemberShell
      activeKey="profile"
      title="个人信息与设置"
      subtitle="可直接编辑资料、上传头像，并同步更新会员档案。"
      stats={[
        { label: "会员等级", value: rewardsTierLabel(rewardsSummary?.membershipTier ?? profile?.membership_tier) },
        { label: "会员状态", value: rewardsStatusLabel(rewardsSummary?.status) },
        { label: "积分余额", value: String(Number(rewardsSummary?.pointsBalance ?? 0).toFixed(0)) },
        { label: "升级进度", value: upgradeStat.value, helper: upgradeStat.helper, progress: upgradeStat.progress, progressLabel: upgradeStat.progressLabel },
      ]}
    >
      {loading ? (
        <section className="rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] p-5 text-sm backdrop-blur-sm dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface-elevated)]">加载中...</section>
      ) : error ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          <p>{error}</p>
          <Link href="/login" className="mt-3 inline-flex rounded-lg border border-primary/40 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10">
            去登录
          </Link>
        </section>
      ) : (
        <section className="ui-table-root rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)] sm:p-6">
          {onboardingMode ? (
            <div className="mb-5 rounded-3xl border border-primary/20 bg-primary/8 px-4 py-4 text-sm text-[color:var(--foreground)]">
              <p className="text-xs font-black tracking-[0.12em] text-primary">ONBOARDING</p>
              <p className="mt-1 text-sm font-black">请先完善会员资料后，才可继续进入其他页面。</p>
              <div className="mt-3 overflow-hidden rounded-full bg-white/8">
                <div className="h-2 rounded-full bg-primary transition-all" style={{ width: `${completionPercent}%` }} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {missingFields.length === 0 ? (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-300">
                    资料已完成
                  </span>
                ) : (
                  missingFields.map((field) => (
                    <span key={field} className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">
                      待补: {missingFieldLabels[field] ?? field}
                    </span>
                  ))
                )}
              </div>
            </div>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:gap-6">
            <div className="rounded-3xl border border-primary/25 bg-gradient-to-b from-[color:var(--theme-surface)] to-[color:var(--theme-surface-elevated)] p-4 shadow-xl shadow-slate-900/10 sm:p-5">
              <p className="text-2xl font-black text-[color:var(--foreground)]">头像</p>
              <div className="mt-5 flex justify-center">
                {profile?.avatar_url ? (
                  <div className="rounded-full bg-[color:var(--warm-surface-800)]/88 p-2 shadow-lg">
                    <Image src={profile.avatar_url} alt="头像预览" width={128} height={128} className="h-28 w-28 rounded-full border-[6px] border-[#d6a15f] object-cover sm:h-32 sm:w-32" unoptimized />
                  </div>
                ) : (
                  <div className="flex h-28 w-28 items-center justify-center rounded-full border-[6px] border-[#d6a15f] bg-[#3b2420] text-4xl font-black text-[#f3ddba] sm:h-32 sm:w-32 sm:text-5xl">
                    {(profile?.full_name || "会").slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <p className="mt-4 text-center text-[11px] font-bold tracking-[0.08em] text-[color:var(--theme-muted)]">个人头像展示</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-[color:var(--foreground)]">个人信息</p>
                <button
                  type="button"
                  onClick={openEditModal}
                  className="rounded-lg border border-primary/30 px-3 py-1.5 text-xs font-black text-primary transition hover:bg-primary/10"
                >
                  编辑资料
                </button>
              </div>
              {onboardingMode ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 px-3 py-3">
                    <p className="text-[11px] font-black tracking-[0.08em] text-primary">完成度</p>
                    <p className="mt-1 text-2xl font-black text-[color:var(--foreground)]">{completionPercent}%</p>
                  </div>
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 px-3 py-3">
                    <p className="text-[11px] font-black tracking-[0.08em] text-primary">已完成</p>
                    <p className="mt-1 text-2xl font-black text-[color:var(--foreground)]">{completedRequiredFields}/{requiredFieldCount}</p>
                  </div>
                  <div className="rounded-2xl border border-primary/15 bg-primary/5 px-3 py-3">
                    <p className="text-[11px] font-black tracking-[0.08em] text-primary">待补字段</p>
                    <p className="mt-1 text-2xl font-black text-[color:var(--foreground)]">{missingFields.length}</p>
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-300">姓名</p>
                  <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{profile?.full_name || "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-300">手机号</p>
                  <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{profile?.phone || "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-300">邮箱</p>
                  <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{profile?.email || "-"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs text-slate-500 dark:text-slate-300">生日日期</p>
                  <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100">{profile?.birth_date || "-"}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs text-slate-500 dark:text-slate-300">地址</p>
                <p className="mt-1 text-sm font-black text-slate-900 dark:text-slate-100 whitespace-pre-line">{(profile?.address || "-").split("|").map((item) => item.trim()).filter(Boolean).join("\n") || "-"}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <UnifiedModal
        open={editOpen}
        title="编辑个人信息"
        description={onboardingMode ? "请先补完手机号后继续使用系统。" : "可更新姓名、手机号、邮箱、地址及头像。"}
        badge="Member"
        size="lg"
        panelClassName="max-w-[980px] sm:max-w-[920px] lg:max-w-[980px] max-h-[calc(100vh-18px)] sm:max-h-[calc(100vh-48px)]"
        actionsClassName="flex-col-reverse sm:flex-row"
        onClose={() => {
          if (onboardingMode) return;
          setEditOpen(false);
        }}
        actions={
          <>
            {!onboardingMode ? (
              <button type="button" onClick={() => setEditOpen(false)} className="rounded-lg border border-[color:var(--theme-border-strong)] px-4 py-2 text-sm font-bold text-[color:var(--foreground)] hover:bg-black/4 dark:hover:bg-white/6">
                取消
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving || avatarUploading}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-black text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存资料"}
            </button>
          </>
        }
      >
        <div className="grid gap-3 lg:grid-cols-[280px_1fr] xl:grid-cols-[300px_1fr]">
          <div className="rounded-2xl border border-primary/15 bg-black/2 p-3 sm:p-4 dark:border-primary/20 dark:bg-white/4">
            <p className="text-xs font-bold tracking-[0.1em] text-[color:var(--theme-muted)]">头像</p>
            <div className="mt-3 flex items-center gap-3 lg:mt-5 lg:flex-col lg:items-center lg:justify-center">
              {editAvatarUrl ? (
                <Image src={editAvatarUrl} alt="头像预览" width={124} height={124} className="h-16 w-16 rounded-full border-4 border-white object-cover shadow-sm dark:border-slate-900 sm:h-20 sm:w-20 lg:h-[124px] lg:w-[124px]" unoptimized />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-black text-primary sm:h-20 sm:w-20 sm:text-3xl lg:h-[124px] lg:w-[124px] lg:text-5xl">
                  {(editName || "会").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1 lg:w-full lg:flex-none">
                <p className="text-sm font-black text-[color:var(--foreground)]">头像预览</p>
                <p className="mt-1 hidden text-[11px] text-[color:var(--theme-muted)] sm:block">建议使用清晰正方形头像，上传后会同步更新会员档案。</p>
                <AdminFilePicker
                  className="mt-2.5"
                  accept="image/*"
                  disabled={avatarUploading}
                  buttonLabel={avatarUploading ? "上传中..." : "上传头像"}
                  onSelect={async (files) => {
                    const file = files[0];
                    if (!file || !supabase) return;
                    setMessage(null);
                    setAvatarUploading(true);
                    const ext = file.name.split(".").pop() || "jpg";
                    const path = `avatars/customers/${Date.now()}.${ext}`;
                    const { error: uploadError } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
                    setAvatarUploading(false);
                    if (uploadError) {
                      setMessage(`头像上传失败：${uploadError.message}`);
                      return;
                    }
                    const { data } = supabase.storage.from("media").getPublicUrl(path);
                    setEditAvatarUrl(data.publicUrl);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="hidden rounded-2xl border border-primary/15 bg-primary/5 px-3.5 py-3 sm:block sm:px-4">
              <p className="text-[11px] font-black tracking-[0.12em] text-primary">PROFILE SETUP</p>
              <p className="mt-1 text-[13px] font-black text-[color:var(--foreground)] sm:text-sm">
                {onboardingMode ? "先完成手机号资料，之后即可继续浏览与下单。" : "更新资料后会同步会员档案与下单信息。"}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-bold tracking-[0.08em] text-slate-500 dark:text-slate-300">姓名</p>
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  placeholder="输入姓名"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold tracking-[0.08em] text-slate-500 dark:text-slate-300">手机号</p>
                <input
                  value={editPhone}
                  onChange={(event) => setEditPhone(event.target.value)}
                  placeholder="+60123456789"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold tracking-[0.08em] text-slate-500 dark:text-slate-300">邮箱</p>
                <input
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                  placeholder="Google 注册会自动带入邮箱"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold tracking-[0.08em] text-slate-500 dark:text-slate-300">生日日期</p>
                <input
                  type="date"
                  value={editBirthDate}
                  onChange={(event) => setEditBirthDate(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary [color-scheme:light] dark:border-slate-700 dark:bg-slate-900/80 dark:[color-scheme:dark]"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-bold tracking-[0.08em] text-slate-500 dark:text-slate-300">地址 1</p>
                <input
                  value={editAddress1}
                  onChange={(event) => setEditAddress1(event.target.value)}
                  placeholder="门牌号 / 街道 / 大厦"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold tracking-[0.08em] text-slate-500 dark:text-slate-300">地址 2</p>
                <input
                  value={editAddress2}
                  onChange={(event) => setEditAddress2(event.target.value)}
                  placeholder="区域 / 区县 / 地标"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold tracking-[0.08em] text-slate-500 dark:text-slate-300">邮编</p>
                <input
                  value={editPostalCode}
                  onChange={(event) => {
                    const value = event.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, 12);
                    setEditPostalCode(value);
                    const inferred = inferStateCountryByPostal(value);
                    if (inferred) {
                      setEditState(inferred.state);
                      setEditCountry(inferred.country);
                    }
                  }}
                  placeholder="例如 50450"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-900/80"
                />
              </div>
              <div>
                <p className="mb-1 text-xs font-bold tracking-[0.08em] text-slate-500 dark:text-slate-300">州属</p>
                <input
                  value={editState}
                  readOnly
                  placeholder="根据邮编自动填入"
                  className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800/70"
                />
              </div>
              <div className="md:col-span-2">
                <p className="mb-1 text-xs font-bold tracking-[0.08em] text-slate-500 dark:text-slate-300">国家</p>
                <input
                  value={editCountry}
                  readOnly
                  placeholder="根据邮编自动填入"
                  className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm outline-none dark:border-slate-700 dark:bg-slate-800/70"
                />
              </div>
            </div>
            {message ? <p className={`text-xs font-bold ${message.includes("已更新") ? "text-emerald-600" : "text-rose-600"}`}>{message}</p> : null}
          </div>
        </div>
      </UnifiedModal>
    </MemberShell>
  );
}

export default function MemberProfilePage() {
  return (
    <Suspense fallback={null}>
      <MemberProfilePageContent />
    </Suspense>
  );
}
