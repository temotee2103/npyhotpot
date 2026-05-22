"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export type MemberSectionKey = "dashboard" | "profile" | "shop_orders" | "delivery_orders" | "rewards" | "coupons" | "referrals";

type MemberShellProps = {
  title: string;
  subtitle: string;
  activeKey: MemberSectionKey;
  children: ReactNode;
  stats?: Array<{
    label: string;
    value: ReactNode;
    helper?: ReactNode;
    progress?: number;
    progressLabel?: ReactNode;
  }>;
};

const navItems: Array<{ key: MemberSectionKey; href: string; label: string; icon: string }> = [
  { key: "profile", href: "/member/profile", label: "个人信息", icon: "person" },
  { key: "shop_orders", href: "/member/orders/shop", label: "商城订单", icon: "receipt_long" },
  { key: "delivery_orders", href: "/member/orders/delivery", label: "外卖订单", icon: "local_shipping" },
  { key: "rewards", href: "/member/rewards", label: "会员积分卡", icon: "card_membership" },
  { key: "coupons", href: "/member/coupons", label: "会员优惠券", icon: "local_offer" },
  { key: "referrals", href: "/member/referrals", label: "推荐有礼", icon: "share" },
];

export function MemberShell({ title, subtitle, activeKey, children, stats = [] }: MemberShellProps) {
  const regularStats = stats.filter((stat) => typeof stat.progress !== "number");
  const progressStats = stats.filter((stat) => typeof stat.progress === "number");

  return (
    <div className="ui-root mx-auto w-full max-w-6xl space-y-4 px-3 pb-4 pt-5 sm:px-4 sm:pb-6 sm:pt-6">
      <div className="ui-table-root rounded-3xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-4 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)] sm:p-5">
        <p className="text-xs font-black tracking-[0.16em] text-primary">MEMBER CENTER</p>
        <h1 className="mt-1 text-2xl font-black text-[color:var(--foreground)] sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-[color:var(--theme-muted)]">{subtitle}</p>
        {stats.length > 0 ? (
          <>
            <div className="mt-4 grid gap-2 lg:hidden">
              {regularStats.length > 0 ? (
                <div className={`grid gap-2 ${regularStats.length >= 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                  {regularStats.map((stat) => (
                    <div key={stat.label} className="min-w-0 rounded-2xl border border-[color:var(--theme-border)] bg-black/2 px-3 py-3 dark:border-[color:var(--theme-border-strong)] dark:bg-white/4">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--theme-muted)]">{stat.label}</p>
                      <div className="mt-1 min-w-0 text-base font-black leading-tight text-[color:var(--foreground)]">{stat.value}</div>
                    </div>
                  ))}
                </div>
              ) : null}
              {progressStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-primary/15 bg-primary/6 px-3 py-3 dark:border-primary/20 dark:bg-white/4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--theme-muted)]">{stat.label}</p>
                  <div className="mt-1 min-w-0 text-lg font-black leading-tight text-[color:var(--foreground)]">{stat.value}</div>
                  {stat.helper ? <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--theme-muted)]">{stat.helper}</p> : null}
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, stat.progress ?? 0))}%` }} />
                    </div>
                    {stat.progressLabel ? <p className="mt-1 text-[11px] font-bold text-primary">{stat.progressLabel}</p> : null}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 hidden lg:grid lg:grid-cols-4 lg:gap-2">
              {stats.map((stat) => (
                <div key={stat.label} className="min-w-0 rounded-2xl border border-[color:var(--theme-border)] bg-black/2 px-3 py-3 dark:border-[color:var(--theme-border-strong)] dark:bg-white/4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--theme-muted)]">{stat.label}</p>
                  <div className="mt-1 min-w-0 text-lg font-black text-[color:var(--foreground)]">{stat.value}</div>
                  {stat.helper ? <p className="mt-1 text-[11px] leading-relaxed text-[color:var(--theme-muted)]">{stat.helper}</p> : null}
                  {typeof stat.progress === "number" ? (
                    <div className="mt-3">
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, stat.progress))}%` }} />
                      </div>
                      {stat.progressLabel ? <p className="mt-1 text-[11px] font-bold text-primary">{stat.progressLabel}</p> : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <aside className="ui-table-root hidden rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-3 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)] lg:block">
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition ${
                  activeKey === item.key
                    ? "bg-primary text-white shadow-sm shadow-primary/20"
                    : "text-[color:var(--theme-muted)] hover:bg-primary/10 hover:text-primary"
                }`}
              >
                <span className="material-symbols-outlined text-base">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>

        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2 lg:hidden">
            {navItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className={`flex min-h-[74px] flex-col items-start justify-between rounded-2xl border px-2.5 py-2.5 transition ${
                  activeKey === item.key
                    ? "border-primary/35 bg-primary text-white shadow-sm shadow-primary/20"
                    : "border-primary/10 bg-[color:var(--theme-surface-elevated)] text-[color:var(--theme-muted)]"
                }`}
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10">
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                </div>
                <div>
                  <p className={`text-[12px] font-black leading-tight ${activeKey === item.key ? "text-white" : "text-[color:var(--foreground)]"}`}>
                    {item.label}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          <div className="space-y-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
