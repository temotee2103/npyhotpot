"use client";

import { FormEvent, useMemo, useState } from "react";
import { hasSupabaseEnv, supabase } from "@/lib/supabase";
import { isStrongPassword } from "@/lib/validators/password";

type AuthCardProps = {
  redirectPath: string;
  title: string;
};

export function AuthCard({ redirectPath, title }: AuthCardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const isDisabled = useMemo(
    () => loading || !email.trim() || !isStrongPassword(password) || !hasSupabaseEnv,
    [email, loading, password, isStrongPassword],
  );

  const passwordInvalid = useMemo(() => !!password && !isStrongPassword(password), [password, isStrongPassword]);

  const handleEmailAuth = async (event: FormEvent) => {
    event.preventDefault();
    if (!isStrongPassword(password)) {
      setMessage("Password must be 8-64 characters and include at least 3 of: lowercase, uppercase, number, symbol.");
      return;
    }
    if (!supabase) {
      setMessage("Supabase environment variables are not configured.");
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
    setMessage(mode === "register" ? "Check your email for verification." : "Login successful.");
  };

  const handleGoogleAuth = async () => {
    if (!supabase) {
      setMessage("Supabase environment variables are not configured.");
      return;
    }
    setLoading(true);
    setMessage("");
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
    <div className="glass-card w-full max-w-xl p-8">
      <h2 className="font-display text-3xl text-primary">{title}</h2>
      <p className="mt-2 text-sm text-[color:var(--theme-muted)]">Use email/password or continue with Google.</p>
      <form className="mt-6 space-y-4" onSubmit={handleEmailAuth}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-4 py-3 text-[color:var(--foreground)] outline-none ring-primary transition focus:ring-2"
        />
        <input
          type="password"
          placeholder="Password (8-64, 3 of: a-z, A-Z, 0-9, symbol)"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-4 py-3 text-[color:var(--foreground)] outline-none ring-primary transition focus:ring-2"
        />
        {passwordInvalid ? (
          <p className="text-xs text-red-500">
            Password must be 8-64 characters and include at least 3 of: lowercase, uppercase, number, symbol.
          </p>
        ) : null}
        <div className="flex gap-3">
          <button type="submit" disabled={isDisabled} className="btn-gradient grow disabled:opacity-50">
            {loading ? "Processing..." : mode === "register" ? "Create Account" : "Login"}
          </button>
          <button
            type="button"
            className="rounded-xl border border-primary/30 px-4 py-3 text-primary transition hover:bg-primary/10"
            onClick={() => setMode(mode === "register" ? "login" : "register")}
          >
            {mode === "register" ? "Have account" : "Register"}
          </button>
        </div>
      </form>
      <button onClick={handleGoogleAuth} className="mt-4 w-full rounded-xl border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-4 py-3 text-[color:var(--foreground)] hover:bg-black/4 dark:hover:bg-white/12">
        Continue with Google
      </button>
      <p className="mt-3 text-sm text-[color:var(--theme-muted)]">{message}</p>
    </div>
  );
}
