"use client";

import { FormEvent, useState } from "react";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import { useLanguage } from "@/components/language-provider";
import { isStrongPassword } from "@/lib/validators/password";

type AuthGateModalProps = {
  open: boolean;
  onClose: () => void;
  redirectPath: string;
};

export function AuthGateModal({ open, onClose, redirectPath }: AuthGateModalProps) {
  const { t, language } = useLanguage();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) {
    return null;
  }

  const passwordInvalid = !!password && !isStrongPassword(password);
  const passwordPlaceholder =
    language === "zh-CN"
      ? `${t("password")}（8-64 位，至少 3 种：小写/大写/数字/符号）`
      : `${t("password")} (8-64, 3 of: a-z, A-Z, 0-9, symbol)`;

  const submitAuth = async (event: FormEvent) => {
    event.preventDefault();
    if (!isStrongPassword(password)) {
      setMessage(
        language === "zh-CN"
          ? "密码需为 8-64 位，并至少包含以下 4 类中的 3 类：小写字母、大写字母、数字、符号。"
          : "Password must be 8-64 characters and include at least 3 of: lowercase, uppercase, number, symbol.",
      );
      return;
    }
    if (!supabase) {
      setMessage(language === "zh-CN" ? "请先配置 Supabase 环境变量。" : "Please configure Supabase environment variables.");
      return;
    }
    setLoading(true);
    setMessage("");
    const response =
      mode === "register"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}${redirectPath}` },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (response.error) {
      setMessage(response.error.message);
      return;
    }
    setMessage(
      language === "zh-CN"
        ? mode === "register"
          ? "注册成功，请检查邮箱验证。"
          : "登录成功。"
        : mode === "register"
          ? "Registration successful. Check your email for verification."
          : "Login successful.",
    );
    if (mode === "login") {
      onClose();
    }
  };

  const googleLogin = async () => {
    if (!supabase) {
      setMessage(language === "zh-CN" ? "请先配置 Supabase 环境变量。" : "Please configure Supabase environment variables.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${redirectPath}` },
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(15,12,12,0.35)] p-4 backdrop-blur-sm dark:bg-black/65">
      <div className="glass-card w-full max-w-md p-6">
        <h2 className="font-display text-4xl text-primary">{t("authTitle")}</h2>
        <p className="mt-2 text-sm text-[color:var(--theme-muted)]">{t("authDesc")}</p>
        <div className="mt-5 flex gap-2">
          <button
            onClick={() => setMode("login")}
            className={`rounded-xl px-4 py-2 ${mode === "login" ? "bg-primary text-white" : "border border-[color:var(--theme-border-strong)] text-[color:var(--foreground)]"}`}
          >
            {t("login")}
          </button>
          <button
            onClick={() => setMode("register")}
            className={`rounded-xl px-4 py-2 ${mode === "register" ? "bg-primary text-white" : "border border-[color:var(--theme-border-strong)] text-[color:var(--foreground)]"}`}
          >
            {t("register")}
          </button>
        </div>
        <form onSubmit={submitAuth} className="mt-4 space-y-3">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={t("email")}
            className="w-full rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-4 py-3 text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-primary/20"
          />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={passwordPlaceholder}
            className="w-full rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-4 py-3 text-[color:var(--foreground)] outline-none focus:ring-2 focus:ring-primary/20"
          />
          {passwordInvalid ? (
            <p className="text-xs text-red-500">
              {language === "zh-CN"
                ? "密码需为 8-64 位，并至少包含以下 4 类中的 3 类：小写字母、大写字母、数字、符号。"
                : "Password must be 8-64 characters and include at least 3 of: lowercase, uppercase, number, symbol."}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={!hasSupabaseEnv || loading || !email.trim() || !isStrongPassword(password)}
            className="btn-gradient w-full disabled:opacity-50"
          >
            {loading ? "..." : mode === "login" ? t("login") : t("register")}
          </button>
        </form>
        <button
          onClick={googleLogin}
          disabled={loading}
          className="mt-3 w-full rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-4 py-3 text-[color:var(--foreground)] transition hover:bg-black/4 dark:hover:bg-white/12"
        >
          {t("googleLogin")}
        </button>
        <button onClick={onClose} className="mt-3 w-full rounded-xl border border-primary/30 px-4 py-2 text-primary transition hover:bg-primary/10">
          {t("continueGuest")}
        </button>
        <p className="mt-3 text-sm text-[color:var(--theme-muted)]">{message}</p>
      </div>
    </div>
  );
}
