"use client";

import "./admin-unified.css";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { LanguageToggle } from "@/components/language-toggle";
import { AdminAuthGate } from "@/components/admin-auth-gate";
import { defaultAdminNavGroups, fetchAdminUiPayload, hydrateAdminNavGroups, type AdminNavGroup } from "@/lib/admin/official-admin-ui";
import { siteConfig } from "@/lib/site-config";

type ChannelKey = "all" | "shop" | "delivery";

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const channel = (searchParams.get("channel") as ChannelKey) || "all";
  const normalizedPathname = useMemo(() => {
    if (!pathname) return "/";
    const withoutBasePath =
      siteConfig.basePath && pathname.startsWith(siteConfig.basePath) ? pathname.slice(siteConfig.basePath.length) || "/" : pathname;
    if (withoutBasePath.length > 1 && withoutBasePath.endsWith("/")) {
      return withoutBasePath.replace(/\/+$/, "");
    }
    return withoutBasePath;
  }, [pathname]);

  const [navGroups, setNavGroups] = useState<AdminNavGroup[] | null>(defaultAdminNavGroups);

  useEffect(() => {
    let active = true;
    fetchAdminUiPayload<AdminNavGroup[]>("admin_nav_groups").then((nav) => {
      if (!active) return;
      setNavGroups(hydrateAdminNavGroups(nav));
    });
    return () => {
      active = false;
    };
  }, []);

  const normalizedNavGroups = useMemo(() => {
    const sourceUserGroupTitle =
      (navGroups ?? []).find(
        (group) =>
          group.links.some((link) => link.href === "/admin/users") ||
          group.links.some((link) => link.href === "/admin/users/customers") ||
          group.links.some((link) => link.href === "/admin/users/admins") ||
          group.title.includes("用户") ||
          group.title.toLowerCase().includes("user"),
      )?.title ?? null;
    const rows = (navGroups ?? defaultAdminNavGroups).map((group) => ({
      ...group,
      links: group.links
        .filter((link) => link.href !== "/admin/users")
        .map((link) => ({
          ...link,
          label: link.label === "Discount" ? "优惠券" : link.label === "Option Groups" ? "规格组" : link.label === "Bundle Set" ? "套餐组合" : link.label,
        })),
    }));
    const deliveryGroup = rows.find((group) => group.title === "外卖配送");
    if (deliveryGroup && !deliveryGroup.links.some((link) => link.href === "/admin/delivery/discounts")) {
      const nextLinks = [...deliveryGroup.links];
      const insertAt = nextLinks.findIndex((x) => x.href === "/admin/delivery/promotions");
      const link = { label: "优惠券", href: "/admin/delivery/discounts", icon: "percent" };
      if (insertAt >= 0) nextLinks.splice(insertAt, 0, link);
      else nextLinks.push(link);
      deliveryGroup.links = nextLinks;
    }
    if (deliveryGroup && !deliveryGroup.links.some((link) => link.href === "/admin/delivery/orders")) {
      const nextLinks = [...deliveryGroup.links];
      const dispatchIndex = nextLinks.findIndex((x) => x.href === "/admin/delivery/dispatch");
      const link = { label: "配送订单", href: "/admin/delivery/orders", icon: "list_alt" };
      if (dispatchIndex >= 0) nextLinks.splice(dispatchIndex, 0, link);
      else nextLinks.push(link);
      deliveryGroup.links = nextLinks;
    }
    if (deliveryGroup?.links.some((link) => link.href === "/admin/delivery/dispatch")) {
      deliveryGroup.links = deliveryGroup.links.filter((link) => link.href !== "/admin/delivery/dispatch");
    }
    if (deliveryGroup && deliveryGroup.links.some((link) => link.href === "/admin/delivery/outlets")) {
      deliveryGroup.links = deliveryGroup.links.filter((link) => link.href !== "/admin/delivery/outlets");
    }
    let platformGroup =
      rows.find((group) => group.title === "平台运营") ??
      rows.find((group) => group.title.includes("平台") || group.title.includes("运营"));
    if (!platformGroup) {
      platformGroup = { title: "平台运营", links: [] };
      rows.push(platformGroup);
    }
    if (!platformGroup.links.some((link) => link.href === "/admin/delivery/outlets")) {
      const nextLinks = [...platformGroup.links];
      const insertAt = nextLinks.findIndex((x) => x.href === "/admin/promotions");
      const link = { label: "分店管理", href: "/admin/delivery/outlets", icon: "storefront" };
      if (insertAt >= 0) nextLinks.splice(insertAt, 0, link);
      else nextLinks.push(link);
      platformGroup.links = nextLinks;
    }
    if (!platformGroup.links.some((link) => link.href === "/admin/platform/points-ledger")) {
      platformGroup.links = [...platformGroup.links, { label: "积分流水", href: "/admin/platform/points-ledger", icon: "receipt_long" }];
    }
    if (!platformGroup.links.some((link) => link.href === "/admin/platform/points-campaigns")) {
      platformGroup.links = [...platformGroup.links, { label: "积分活动", href: "/admin/platform/points-campaigns", icon: "campaign" }];
    }
    if (!platformGroup.links.some((link) => link.href === "/admin/platform/coupons")) {
      platformGroup.links = [...platformGroup.links, { label: "会员优惠券", href: "/admin/platform/coupons", icon: "local_offer" }];
    }
    if (!platformGroup.links.some((link) => link.href === "/admin/platform/system-health")) {
      platformGroup.links = [...platformGroup.links, { label: "系统健康", href: "/admin/platform/system-health", icon: "monitor_heart" }];
    }
    const usersGroup =
      rows.find((group) => sourceUserGroupTitle !== null && group.title === sourceUserGroupTitle) ??
      rows.find((group) => group.title.includes("用户") || group.title.toLowerCase().includes("user"));
    if (usersGroup && !usersGroup.links.some((link) => link.href === "/admin/users/customers")) {
      usersGroup.links = [
        ...usersGroup.links,
        { label: "普通用户", href: "/admin/users/customers", icon: "person" },
        { label: "管理员", href: "/admin/users/admins", icon: "admin_panel_settings" },
        { label: "Merchant账号", href: "/admin/users/merchants", icon: "storefront" },
      ];
    }
    if (usersGroup && !usersGroup.links.some((link) => link.href === "/admin/users/rewards-accruals")) {
      usersGroup.links = [...usersGroup.links, { label: "积分审批", href: "/admin/users/rewards-accruals", icon: "qr_code_scanner" }];
    }
    if (usersGroup && !usersGroup.links.some((link) => link.href === "/admin/users/merchants")) {
      usersGroup.links = [...usersGroup.links, { label: "Merchant账号", href: "/admin/users/merchants", icon: "storefront" }];
    }
    return rows;
  }, [navGroups]);

  const currentPageMeta = (() => {
    if (normalizedPathname === "/admin") {
      return { title: "运营概览", group: "运营控制台" };
    }

    for (const group of normalizedNavGroups) {
      const matchedLink = group.links.find((link) => link.href === normalizedPathname);
      if (matchedLink) {
        return { title: matchedLink.label, group: group.title };
      }
    }

    return { title: "后台页面", group: "运营控制台" };
  })();

  const linkWithChannel = (href: string) => `${href}?channel=${channel}`;

  const isLoginPage = normalizedPathname === "/admin/login";

  return (
    <div className="min-h-screen bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <div className={`grid min-h-screen grid-cols-1 ${isLoginPage ? "" : "lg:grid-cols-[290px_1fr]"}`}>
        {!isLoginPage ? (
          <aside className="border-b border-primary/10 bg-[#fff9f4] p-4 dark:border-primary/20 dark:bg-slate-900 lg:border-b-0 lg:border-r lg:p-6">
          <div className="mb-6 flex items-center justify-between">
            <Link href="/" className="inline-flex items-center gap-2 text-sm font-bold text-primary">
              <span className="material-symbols-outlined text-base">arrow_back</span>
              返回首页
            </Link>
            <LanguageToggle />
          </div>
          <div className="rounded-2xl border border-primary/10 bg-white p-4 shadow-sm dark:border-primary/20 dark:bg-slate-800/70">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">Nanpengyou Admin</p>
            <p className="mt-2 text-xl font-black">运营控制台</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">统一管理商城与外卖业务</p>
          </div>
          <div className="mt-6 space-y-5">
            {normalizedNavGroups.map((group) => (
              <div key={group.title}>
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-slate-400">{group.title}</p>
                <div className="space-y-1.5">
                  {group.links.map((link) => {
                    const active = normalizedPathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={linkWithChannel(link.href)}
                        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                          active
                            ? "bg-primary text-white shadow-lg shadow-primary/30"
                            : "text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60"
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">{link.icon}</span>
                        <span>{link.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          </aside>
        ) : null}

        <div className="flex min-h-screen flex-col">
          <header className="border-b border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] px-4 py-4 shadow-[0_16px_38px_-30px_rgba(70,33,26,0.24)] backdrop-blur-xl dark:border-primary/20 dark:bg-background-dark lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary">{isLoginPage ? "运营控制台" : currentPageMeta.group}</p>
                <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-slate-100">{isLoginPage ? "后台登录" : currentPageMeta.title}</h2>
              </div>
            </div>
          </header>
          <main className="ui-root flex-1 px-4 py-6 lg:px-8">{isLoginPage ? children : <AdminAuthGate>{children}</AdminAuthGate>}</main>
        </div>
      </div>
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </Suspense>
  );
}
