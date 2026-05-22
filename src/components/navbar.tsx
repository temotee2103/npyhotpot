"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { assetPath } from "@/lib/site-config";
import { useLanguage } from "@/components/language-provider";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

type NavbarProps = {
  onCartClick?: () => void;
  cartCount?: number;
};

export function Navbar({ onCartClick, cartCount = 0 }: NavbarProps) {
  const { t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const showCartEntry = pathname === "/delivery" || pathname.startsWith("/shop") || Boolean(onCartClick);
  const [userName, setUserName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [userRole, setUserRole] = useState<"customer" | "merchant" | "admin" | "super_admin" | null>(null);
  const [isAuthed, setIsAuthed] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let active = true;
    const loadAuth = async () => {
      const { data } = await client.auth.getSession();
      if (!active) return;
      const user = data.session?.user ?? null;
      if (!user) {
        setIsAuthed(false);
        setUserName("");
        setAvatarUrl("");
        setUserRole(null);
        return;
      }
      setIsAuthed(true);
      const profileRes = await client
        .from("official_profiles")
        .select("full_name,avatar_url,role")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      setUserName((profileRes.data?.full_name ?? user.email ?? "会员").trim());
      setAvatarUrl(profileRes.data?.avatar_url ?? "");
      setUserRole((profileRes.data?.role as "customer" | "merchant" | "admin" | "super_admin" | null) ?? "customer");
    };
    void loadAuth();
    const { data: subscription } = client.auth.onAuthStateChange(() => {
      void loadAuth();
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setMenuOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!menuContainerRef.current || !target) return;
      if (!menuContainerRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, []);

  const onSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.replace("/");
  };

  const userInitial = userName.slice(0, 1).toUpperCase();
  const customerMenuItems = [
    { href: "/member/profile", icon: "person", label: "个人信息" },
    { href: "/member/orders/shop", icon: "receipt_long", label: "商城订单" },
    { href: "/member/orders/delivery", icon: "local_shipping", label: "外卖订单" },
    { href: "/member/rewards", icon: "card_membership", label: "会员积分卡" },
    { href: "/member/coupons", icon: "local_offer", label: "会员优惠券" },
    { href: "/member/referrals", icon: "share", label: "推荐有礼" },
  ];

  const navLinks = [
    { href: "/", label: t("navHome") || "首页" },
    { href: "/shop", label: t("navShop") || "商城" },
    { href: "/delivery", label: t("navDelivery") || "外卖" },
  ];

  return (
    <>
      <header
        className={`mobile-safe-top fixed inset-x-0 top-0 z-50 w-full border-b px-3 transition-all duration-300 md:px-10 ${
          scrolled
            ? "border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)]/95 shadow-[0_16px_38px_-28px_rgba(70,33,26,0.3)] backdrop-blur-xl dark:border-primary/20 dark:bg-background-dark/95"
            : "border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)]/88 shadow-[0_10px_28px_-24px_rgba(70,33,26,0.18)] backdrop-blur-xl dark:border-transparent dark:bg-background-dark/80"
        }`}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 sm:h-[78px] md:h-[88px] md:gap-4">
          <Link href="/" className="group flex min-w-0 items-center gap-3">
            <div className="relative h-12 w-36 sm:h-14 sm:w-40 md:h-16 md:w-48">
              <Image src={assetPath("/logo.png")} alt="Nanpengyou Hotpot Logo" fill className="object-contain object-left" />
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-[color:var(--theme-border)] bg-white/78 p-1 shadow-sm backdrop-blur-sm md:flex dark:border-primary/5 dark:bg-white/5">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-6 py-2 text-sm font-bold transition-all ${
                    isActive
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "text-[color:var(--theme-muted)] hover:bg-white hover:text-primary dark:hover:bg-white/10"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
            {showCartEntry ? (
              <button
                type="button"
                onClick={() => {
                  if (onCartClick) {
                    onCartClick();
                    return;
                  }
                  if (pathname.startsWith("/shop")) {
                router.push("/shop/checkout");
                return;
              }
              if (pathname.startsWith("/delivery")) {
                router.push("/delivery/checkout");
                  }
                }}
                className="tap-bouncy relative flex h-10 w-10 items-center justify-center rounded-xl text-[color:var(--foreground)] transition-colors hover:bg-black/4 dark:text-slate-300 dark:hover:bg-white/10"
              >
                <span className="material-symbols-outlined">shopping_cart</span>
                <span key={cartCount} className="cart-badge-pop absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {cartCount}
                </span>
              </button>
            ) : null}
            {isAuthed ? (
              <div className="relative" ref={menuContainerRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-primary/30 bg-white/92 text-xs font-black text-primary shadow-sm transition-colors hover:border-primary dark:bg-slate-900/80"
                >
                  {avatarUrl ? (
                    <Image src={avatarUrl} alt={userName || "User Avatar"} width={40} height={40} className="h-full w-full cursor-pointer object-cover" unoptimized />
                  ) : (
                    <span>{userInitial || "U"}</span>
                  )}
                </button>
                {menuOpen ? (
                  <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] p-2 shadow-xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900">
                    <div className="rounded-lg bg-black/2 px-3 py-2 dark:bg-slate-800/80">
                      <p className="text-xs font-bold text-[color:var(--theme-muted)] dark:text-slate-300">{userRole === "merchant" ? "Merchant" : userRole === "admin" || userRole === "super_admin" ? "Admin" : "Member"}</p>
                      <p className="truncate text-sm font-bold text-[color:var(--foreground)] dark:text-slate-100">{userName || "会员"}</p>
                    </div>
                    {userRole === "admin" || userRole === "super_admin" ? (
                      <Link href="/admin?channel=all" onClick={() => setMenuOpen(false)} className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-black/4 dark:text-slate-200 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-base">dashboard</span>
                        <span>进入后台</span>
                      </Link>
                    ) : userRole === "merchant" ? (
                      <Link href="/merchant/rewards/scan" onClick={() => setMenuOpen(false)} className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-black/4 dark:text-slate-200 dark:hover:bg-slate-800">
                        <span className="material-symbols-outlined text-base">qr_code_scanner</span>
                        <span>Merchant 扫码</span>
                      </Link>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {customerMenuItems.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[color:var(--foreground)] transition hover:bg-black/4 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <span className="material-symbols-outlined text-base">{item.icon}</span>
                            <span>{item.label}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void onSignOut()}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <span className="material-symbols-outlined text-base">logout</span>
                      <span>退出登录</span>
                    </button>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link href="/login" className="rounded-full border border-primary/30 px-3 py-2 text-[11px] font-black text-primary transition hover:bg-primary/10 sm:text-xs">
                  登录
                </Link>
                <Link href="/register" className="rounded-full bg-primary px-3 py-2 text-[11px] font-black text-white transition hover:bg-primary/90 sm:text-xs">
                  注册
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      <div aria-hidden className="h-[72px] sm:h-[78px] md:h-[88px]" />
    </>
  );
}
