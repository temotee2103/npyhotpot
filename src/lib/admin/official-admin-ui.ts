import { supabase } from "@/lib/supabase";

export type AdminNavLink = {
  label: string;
  href: string;
  icon: string;
};

export type AdminNavGroup = {
  title: string;
  links: AdminNavLink[];
};

export const defaultAdminNavGroups: AdminNavGroup[] = [
  {
    title: "总览",
    links: [{ label: "运营概览", href: "/admin", icon: "dashboard" }],
  },
  {
    title: "在线商城",
    links: [
      { label: "商城总览", href: "/admin/shop", icon: "storefront" },
      { label: "商品管理", href: "/admin/shop/products", icon: "inventory_2" },
      { label: "套餐组合", href: "/admin/shop/bundles", icon: "deployed_code" },
      { label: "优惠券", href: "/admin/shop/discounts", icon: "percent" },
      { label: "促销活动", href: "/admin/shop/promotions", icon: "local_offer" },
      { label: "商城订单", href: "/admin/shop/orders", icon: "receipt_long" },
    ],
  },
  {
    title: "外卖配送",
    links: [
      { label: "菜单总览", href: "/admin/delivery", icon: "restaurant_menu" },
      { label: "单品管理", href: "/admin/delivery/menu/items", icon: "list_alt" },
      { label: "套餐管理", href: "/admin/delivery/menu/combos", icon: "inventory_2" },
      { label: "规格组", href: "/admin/delivery/menu/option-groups", icon: "tune" },
      { label: "类目管理", href: "/admin/delivery/menu/categories", icon: "category" },
      { label: "优惠券", href: "/admin/delivery/discounts", icon: "percent" },
      { label: "促销活动", href: "/admin/delivery/promotions", icon: "local_offer" },
      { label: "配送订单", href: "/admin/delivery/orders", icon: "list_alt" },
    ],
  },
  {
    title: "平台运营",
    links: [
      { label: "分店管理", href: "/admin/delivery/outlets", icon: "storefront" },
      { label: "普通用户", href: "/admin/users/customers", icon: "person" },
      { label: "管理员", href: "/admin/users/admins", icon: "admin_panel_settings" },
      { label: "Merchant账号", href: "/admin/users/merchants", icon: "storefront" },
      { label: "积分审批", href: "/admin/users/rewards-accruals", icon: "qr_code_scanner" },
      { label: "积分流水", href: "/admin/platform/points-ledger", icon: "receipt_long" },
      { label: "积分活动", href: "/admin/platform/points-campaigns", icon: "campaign" },
      { label: "会员优惠券", href: "/admin/platform/coupons", icon: "local_offer" },
      { label: "系统健康", href: "/admin/platform/system-health", icon: "monitor_heart" },
      { label: "报表中心", href: "/admin/reports", icon: "bar_chart" },
    ],
  },
];

export function hydrateAdminNavGroups(payload: AdminNavGroup[] | null | undefined): AdminNavGroup[] {
  const source = Array.isArray(payload) ? payload : [];
  const groupMap = new Map<string, AdminNavGroup>();

  for (const group of defaultAdminNavGroups) {
    groupMap.set(group.title, {
      title: group.title,
      links: [...group.links],
    });
  }

  for (const group of source) {
    const existing = groupMap.get(group.title);
    if (!existing) {
      groupMap.set(group.title, {
        title: group.title,
        links: [...group.links],
      });
      continue;
    }

    const mergedLinks = [...existing.links];
    for (const link of group.links) {
      const index = mergedLinks.findIndex((item) => item.href === link.href);
      if (index >= 0) mergedLinks[index] = link;
      else mergedLinks.push(link);
    }
    groupMap.set(group.title, { title: group.title, links: mergedLinks });
  }

  return defaultAdminNavGroups.map((group) => groupMap.get(group.title) ?? group);
}

export type AdminChannelTab = {
  key: "all" | "shop" | "delivery";
  label: string;
  desc: string;
};

export type AdminQuickLink = {
  href: string;
  icon: string;
  title: string;
  desc: string;
};

export type AdminDeliveryModuleCard = {
  title: string;
  href: string;
  icon: string;
  desc: string;
};

export async function fetchAdminUiPayload<T>(key: string): Promise<T | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("official_admin_ui").select("payload").eq("key", key).maybeSingle();
  if (error || !data) return null;
  return (data as unknown as { payload: T }).payload ?? null;
}
