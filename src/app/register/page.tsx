"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { GoogleAuthButton } from "@/components/google-auth-button";
import { assetPath } from "@/lib/site-config";
import { hasSupabaseEnv, missingSupabaseEnv, supabase } from "@/lib/supabase";
import { isValidAddress } from "@/lib/validators/address";
import { isStrongPassword } from "@/lib/validators/password";
import { isValidE164Phone, normalizePhoneToE164 } from "@/lib/validators/phone";

type AddressParts = {
  address1: string;
  address2: string;
  postalCode: string;
  state: string;
  country: string;
};

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

function normalizeReferralCode(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

function RegisterPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialReferralCode = normalizeReferralCode(searchParams.get("ref") ?? searchParams.get("referral") ?? "");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [referralCode, setReferralCode] = useState(initialReferralCode);
  const referralLocked = Boolean(initialReferralCode);
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("Malaysia");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [nonBlockingMessage, setNonBlockingMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [registerStep, setRegisterStep] = useState<0 | 1>(0);

  const registerSuccessPath = "/member/profile?welcome=1";

  const validateRegisterStepOne = () => {
    if (!name.trim() || !phone.trim() || !email.trim() || !birthDate.trim() || !password || !passwordConfirm) {
      setMessage("请先填写完整的账号基础资料");
      return false;
    }
    const normalizedPhone = normalizePhoneToE164(phone);
    if (!isValidE164Phone(normalizedPhone)) {
      setMessage("请输入有效手机号（示例：+60123456789）");
      return false;
    }
    if (!isStrongPassword(password)) {
      setMessage("密码至少8位并包含大小写/数字/符号中的3类");
      return false;
    }
    if (password !== passwordConfirm) {
      setMessage("两次输入的密码不一致");
      return false;
    }
    return true;
  };

  const onRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setNonBlockingMessage(null);
    if (!hasSupabaseEnv || !supabase) {
      setMessage(`Supabase 环境变量缺失：${missingSupabaseEnv.join(", ")}`);
      return;
    }
    if (!name.trim() || !phone.trim() || !email.trim() || !address1.trim() || !postalCode.trim() || !password || !passwordConfirm) {
      setMessage("请填写完整资料");
      return;
    }
    const normalizedPhone = normalizePhoneToE164(phone);
    if (!isValidE164Phone(normalizedPhone)) {
      setMessage("请输入有效手机号（示例：+60123456789）");
      return;
    }
    const mergedAddress = composeAddressParts({ address1, address2, postalCode, state, country });
    if (!isValidAddress(mergedAddress)) {
      setMessage("地址长度需在 10 到 200 字符之间");
      return;
    }
    if (!isStrongPassword(password)) {
      setMessage("密码至少8位并包含大小写/数字/符号中的3类");
      return;
    }
    if (password !== passwordConfirm) {
      setMessage("两次输入的密码不一致");
      return;
    }

    setBusy(true);
    const signUpRes = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/member/rewards`,
        data: { full_name: name.trim(), phone: normalizedPhone, referral_code: referralCode.trim() || null, birth_date: birthDate || null },
      },
    });
    if (signUpRes.error) {
      setBusy(false);
      setMessage(signUpRes.error.message);
      return;
    }

    const userId = signUpRes.data.user?.id;
    if (userId) {
      const { error: upsertError } = await supabase.from("official_profiles").upsert(
        {
          id: userId,
          full_name: name.trim(),
          phone: normalizedPhone,
          email: email.trim().toLowerCase(),
          address: mergedAddress.trim(),
          birth_date: birthDate || null,
          role: "customer",
          status: "active",
          membership_tier: "none",
          cumulative_spend_myr: 0,
        },
        { onConflict: "id" },
      );
      if (upsertError) {
        setNonBlockingMessage("会员资料同步失败，但注册仍已完成。可稍后在个人资料页重新保存。");
      }
      if (signUpRes.data.session) {
        try {
          await supabase.functions.invoke("ensure-official-profile", { body: {} });
        } catch {}
        await supabase.functions.invoke("member-rewards-card", { body: {} });
      }
    }

    setBusy(false);
    setSuccess(true);
    setMessage("注册成功，请检查邮箱验证链接。若邮箱验证已关闭，可直接登录。");
  };

  const onGoogleRegister = async () => {
    setMessage(null);
    setNonBlockingMessage(null);
    if (!hasSupabaseEnv || !supabase) {
      setMessage(`Supabase 环境变量缺失：${missingSupabaseEnv.join(", ")}`);
      return;
    }
    setBusy(true);
    const params = new URLSearchParams({
      source: "register",
      next: registerSuccessPath,
    });
    if (referralCode.trim()) {
      params.set("ref", referralCode.trim());
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?${params.toString()}`,
        queryParams: {
          prompt: "select_account",
        },
      },
    });
    setBusy(false);
    if (error) setMessage(error.message);
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cover bg-center bg-no-repeat px-4 py-6 md:py-8"
      style={{
        backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDDVIm0gONe80jA6AuJrXzUATNHRCAsVSGPRm3w7qXhLqKaOmMXCBOEnT-BHAg2EKDTOB4JJ1xdjZDDGmG-1M8oyiJUcuN1vi4lg5nEr8U5lHpQlmINZceuIyYvjYTnt8q7vZLshrPGma1wGWvDzNJJrwqpqHvwu7oilf6OXcl0DDgp03NJ4NI18GU-kUVxTXBS9YQYp34ZLrff1OcoBjRcksLL9DpzdeTXB2o3GaXkL41oY08Zlf03tzbQ3435XMlS-ZedY8oMdmQw')`,
      }}
    >
      <div className="absolute inset-0 bg-[#221011]/74" />
      <div className="absolute inset-x-0 top-0 z-20 flex items-center px-4 py-4 md:px-8">
        <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-[color:var(--theme-surface-elevated)] px-4 py-2 text-sm font-bold text-[color:var(--foreground)] shadow-sm backdrop-blur-md hover:border-primary/40 hover:text-primary">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          返回首页
        </Link>
      </div>
      <div className="relative z-10 w-full max-w-3xl overflow-hidden rounded-[28px] border border-primary/15 bg-[rgba(28,16,19,0.9)] shadow-[0_28px_70px_-34px_rgba(0,0,0,0.82)] backdrop-blur-xl">
        <div className="relative flex h-32 w-full flex-col justify-end bg-cover bg-center bg-no-repeat p-4 sm:h-36 sm:p-5" style={{ backgroundImage: `url('https://lh3.googleusercontent.com/aida-public/AB6AXuDkbUAaSO_d7CnQveh9F2sEURNomQoij-dzUfZ3PEjuuD9ebdG_slTnXSwqIY8fCq13etD62_DzfT5PdoCmDaQ3upg3cOmlIQniUpj8xu5gKa9EN5Ou4b0R77XuGAOjMNeXje0El98PGuHPIinU3pCm1TitqRbNAqIEe4rNj4uIgwu6HgG-Trm33sKG2cQmrNWKEnocfFRwMCptEzgO9d-iY0_90HiOU_4_czfCdi_jA0rsUsKjARcPndlpWQh6TIAZ9iccEcCf4ccO')` }}>
          <div className="absolute inset-0 bg-gradient-to-t from-[#221011] via-[#221011]/70 to-transparent"></div>
          <div className="relative z-10 flex items-center gap-3">
            <div className="relative h-14 w-14 rounded-xl bg-white/10 p-1 shadow-sm backdrop-blur-sm">
              <Image
                src={assetPath("/favicon.png")}
                alt="Nanpengyou Logo"
                fill
                className="object-contain"
              />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary">Member Signup</p>
              <h1 className="text-2xl font-black leading-tight tracking-tight text-white">男朋友火锅</h1>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-[color:var(--theme-muted-strong)]">Nanpengyou Hotpot</p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-7">
          <div className="mb-6 flex flex-col gap-1.5">
            <h2 className="text-xl font-bold text-[color:var(--foreground)]">创建账号</h2>
            <p className="text-sm text-[color:var(--theme-muted)]">注册成为男朋友会员，消费即可累计积分与返利权益。</p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 md:hidden">
            {[
              { index: 0 as const, title: "账号资料", subtitle: "基本信息" },
              { index: 1 as const, title: "地址资料", subtitle: "收货与推荐" },
            ].map((step) => {
              const active = registerStep === step.index;
              return (
                <button
                  key={step.index}
                  type="button"
                  onClick={() => {
                    if (step.index === 1 && !validateRegisterStepOne()) return;
                    setMessage(null);
                    setRegisterStep(step.index);
                  }}
                  className={`rounded-2xl border px-3 py-3 text-left transition ${
                    active
                      ? "border-primary/35 bg-primary/10"
                      : "border-white/8 bg-white/4"
                  }`}
                >
                  <p className={`text-[11px] font-black tracking-[0.12em] ${active ? "text-primary" : "text-[color:var(--theme-muted-soft)]"}`}>STEP {step.index + 1}</p>
                  <p className="mt-1 text-sm font-black text-[color:var(--foreground)]">{step.title}</p>
                  <p className="mt-0.5 text-[11px] text-[color:var(--theme-muted)]">{step.subtitle}</p>
                </button>
              );
            })}
          </div>

          <form className="grid gap-4 md:grid-cols-2" onSubmit={onRegister}>
            <div className={`${registerStep === 0 ? "block" : "hidden"} space-y-2 md:block`}>
              <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">姓名</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">badge</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="请输入姓名"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className={`${registerStep === 0 ? "block" : "hidden"} space-y-2 md:block`}>
              <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">手机号</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">call</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/[^\d+\-\s]/g, "").slice(0, 24))}
                  placeholder="+60123456789"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className={`${registerStep === 0 ? "block" : "hidden"} space-y-2 md:block`}>
              <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">密码</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">lock</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  type={showPassword ? "text" : "password"}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-11 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[color:var(--theme-muted-soft)] transition-colors hover:text-[color:var(--theme-muted-strong)]" type="button" onClick={() => setShowPassword((prev) => !prev)}>
                  <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            <div className={`${registerStep === 0 ? "block" : "hidden"} space-y-2 md:block`}>
              <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">确认密码</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">verified_user</span>
                <input
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  placeholder="请再次输入密码"
                  type={showPasswordConfirm ? "text" : "password"}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-11 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <button className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[color:var(--theme-muted-soft)] transition-colors hover:text-[color:var(--theme-muted-strong)]" type="button" onClick={() => setShowPasswordConfirm((prev) => !prev)}>
                  <span className="material-symbols-outlined">{showPasswordConfirm ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            <div className={`${registerStep === 0 ? "block" : "hidden"} space-y-2 md:block`}>
              <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">邮箱</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">mail</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="请输入邮箱"
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className={`${registerStep === 0 ? "block" : "hidden"} space-y-2 md:block`}>
              <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">生日日期</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">cake</span>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(event) => setBirthDate(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>

            <div className={`${registerStep === 1 ? "block" : "hidden"} space-y-2 md:col-span-2 md:block`}>
              <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">地址信息</label>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">home_pin</span>
                  <input
                    value={address1}
                    onChange={(event) => setAddress1(event.target.value)}
                    placeholder="地址 1"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">map</span>
                  <input
                    value={address2}
                    onChange={(event) => setAddress2(event.target.value)}
                    placeholder="地址 2（可选）"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">markunread_mailbox</span>
                  <input
                    value={postalCode}
                    onChange={(event) => {
                      const value = event.target.value.toUpperCase().replace(/[^A-Z0-9 -]/g, "").slice(0, 12);
                      setPostalCode(value);
                      const inferred = inferStateCountryByPostal(value);
                      if (inferred) {
                        setState(inferred.state);
                        setCountry(inferred.country);
                      }
                    }}
                    placeholder="邮编（例如 50450）"
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">location_city</span>
                  <input
                    value={state}
                    readOnly
                    placeholder="州属（根据邮编自动填入）"
                    className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--theme-muted)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all"
                  />
                </div>
                <div className="relative md:col-span-2">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">public</span>
                  <input
                    value={country}
                    readOnly
                    placeholder="国家"
                    className="w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--theme-muted)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            <div className={`${registerStep === 1 ? "block" : "hidden"} space-y-2 md:col-span-2 md:block`}>
              <label className="block text-sm font-medium text-[color:var(--theme-muted-strong)]">推荐码</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[20px] text-[color:var(--theme-muted-soft)]">group_add</span>
                <input
                  value={referralCode}
                  onChange={(event) => {
                    if (referralLocked) return;
                    const normalized = event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
                    setReferralCode(normalized);
                  }}
                  placeholder="可选填写推荐码"
                  readOnly={referralLocked}
                  className={`w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted-soft)] outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20 ${referralLocked ? "cursor-not-allowed opacity-80" : ""}`}
                />
              </div>
              {referralLocked ? <p className="text-[11px] font-bold text-primary">已根据推荐链接自动填入并锁定</p> : null}
            </div>

            {message ? <p className={`md:col-span-2 rounded-xl px-3 py-2 text-xs font-bold ${success ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200" : "border border-rose-500/20 bg-rose-500/10 text-rose-200"}`}>{message}</p> : null}
            {nonBlockingMessage ? <p className="md:col-span-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100">{nonBlockingMessage}</p> : null}

            <div className="grid grid-cols-2 gap-3 md:hidden">
              {registerStep === 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    setRegisterStep(0);
                  }}
                  className="rounded-xl border border-primary/25 py-3 text-sm font-bold text-primary"
                >
                  上一步
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMessage(null);
                    if (!validateRegisterStepOne()) return;
                    setRegisterStep(1);
                  }}
                  className="col-span-2 rounded-xl border border-primary/25 py-3 text-sm font-bold text-primary"
                >
                  下一步
                </button>
              )}
              {registerStep === 1 ? (
                <button disabled={busy} className="rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] hover:bg-primary/90 disabled:opacity-60" type="submit">
                  {busy ? "处理中..." : "提交注册"}
                </button>
              ) : null}
            </div>

            <button disabled={busy} className="hidden w-full rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all active:scale-[0.98] hover:bg-primary/90 disabled:opacity-60 md:col-span-2 md:block" type="submit">
              {busy ? "处理中..." : "注册账号"}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#221011] px-3 text-[color:var(--theme-muted-soft)]">Google</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <GoogleAuthButton disabled={busy} onClick={() => void onGoogleRegister()} label="Sign in with Google" />
            <p className="text-center text-[11px] leading-5 text-[color:var(--theme-muted-soft)]">首次 Google 注册会自动创建会员资料，推荐码也会一起带入。</p>
          </div>

          <div className="mt-6 border-t border-white/5 pt-5 text-center">
            <p className="text-sm text-[color:var(--theme-muted)]">
              已有账号？
              <Link className="ml-1 font-bold text-primary hover:underline" href="/login">去登录</Link>
            </p>
            {success ? (
              <button type="button" onClick={() => router.push("/login")} className="mt-2 text-xs font-bold text-primary hover:underline">
                立即前往登录
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-center gap-2 bg-primary/5 px-4 py-3">
          <span className="material-symbols-outlined text-primary text-sm">verified_user</span>
          <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--theme-muted-soft)]">Secure SSL Encryption</span>
        </div>
      </div>
      <div aria-hidden className="mobile-page-bottom-space md:hidden" />
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterPageContent />
    </Suspense>
  );
}
