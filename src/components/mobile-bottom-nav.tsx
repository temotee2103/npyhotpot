"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isHiddenRoute(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/merchant") ||
    pathname.startsWith("/payment")
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  if (isHiddenRoute(pathname)) {
    return null;
  }

  const items = [
    {
      href: "/",
      label: "首页",
      icon: "home",
      active: pathname === "/",
    },
    {
      href: "/shop",
      label: "商城",
      icon: "shopping_bag",
      active: pathname.startsWith("/shop"),
    },
    {
      href: "/delivery",
      label: "外卖",
      icon: "room_service",
      active: pathname.startsWith("/delivery"),
    },
    {
      href: "/member/profile",
      label: "会员",
      icon: "person",
      active: pathname.startsWith("/member"),
    },
  ];

  return (
    <>
      <div aria-hidden className="h-[92px] md:hidden" />
      <nav className="mobile-bottom-nav md:hidden">
        <div className="mobile-bottom-nav__inner">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`mobile-bottom-nav__item ${item.active ? "is-active" : ""}`}
            >
              <span className="material-symbols-outlined mobile-bottom-nav__icon">{item.icon}</span>
              <span className="mobile-bottom-nav__label">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}
