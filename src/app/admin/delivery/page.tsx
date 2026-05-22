"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { fetchOfficialMenuCategories, fetchOfficialMenuItems, type OfficialMenuCategory, type OfficialMenuItem } from "@/lib/admin/official-delivery";
import { fetchAdminUiPayload, type AdminDeliveryModuleCard } from "@/lib/admin/official-admin-ui";

function AdminDeliveryPageContent() {
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "delivery";
  const [categories, setCategories] = useState<OfficialMenuCategory[] | null>(null);
  const [alaCarteItems, setAlaCarteItems] = useState<OfficialMenuItem[] | null>(null);
  const [comboItems, setComboItems] = useState<OfficialMenuItem[] | null>(null);
  const [moduleCards, setModuleCards] = useState<AdminDeliveryModuleCard[] | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([fetchOfficialMenuCategories(), fetchOfficialMenuItems("ala_carte"), fetchOfficialMenuItems("combo")]).then(
      ([cats, ala, combos]) => {
        if (!active) return;
        setCategories(cats);
        setAlaCarteItems(ala);
        setComboItems(combos);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchAdminUiPayload<AdminDeliveryModuleCard[]>("admin_delivery_module_cards").then((data) => {
      if (!active) return;
      setModuleCards(data ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  const categoryName = useMemo(() => {
    const map = new Map((categories ?? []).map((c) => [c.id, c.name]));
    return (id: string | null | undefined) => {
      if (!id) return "-";
      return map.get(id) ?? id;
    };
  }, [categories]);

  const normalizedModuleCards = useMemo(() => {
    const cards = [...(moduleCards ?? [])];
    if (!cards.some((card) => card.href === "/admin/delivery/orders")) {
      cards.unshift({
        title: "配送订单",
        desc: "统一管理配送订单、支付状态、履约轨迹与客服动作。",
        href: "/admin/delivery/orders",
        icon: "list_alt",
      });
    }
    return cards;
  }, [moduleCards]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h1 className="text-3xl font-black">菜单管理（拆分子页面）</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">每个功能独立页面：类目、单品、套餐、Option Group，管理更清晰。</p>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        {normalizedModuleCards.map((card) => (
          <Link
            key={card.href}
            href={`${card.href}?channel=${channel}`}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-primary/40 hover:bg-primary/5 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-primary/10"
          >
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">{card.icon}</span>
              <p className="text-lg font-black">{card.title}</p>
            </div>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">{card.desc}</p>
          </Link>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-xl font-black">近期热销商品</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(alaCarteItems ?? []).slice(0, 4).map((item) => (
              <div key={item.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                    {item.official_menu_categories?.name ?? categoryName(item.category_id)} · RM {Number(item.base_price).toFixed(2)}
                  </p>
                </div>
                <Link
                  className="rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                  href={`/admin/delivery/menu/items/edit?id=${item.id}&channel=${channel}`}
                >
                  编辑
                </Link>
              </div>
            ))}
            {alaCarteItems && alaCarteItems.length === 0 && (
              <div className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300">暂无数据</div>
            )}
            {alaCarteItems === null && (
              <div className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300">加载中...</div>
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">套餐发布提醒</h2>
          <div className="mt-3 space-y-2">
            {(comboItems ?? []).map((combo) => (
              <div key={combo.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{combo.name}</p>
                  <span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] font-bold text-primary">{combo.is_active ? "上架" : "草稿"}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">RM {Number(combo.base_price).toFixed(2)}</p>
                <Link
                  className="mt-3 inline-flex rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                  href={`/admin/delivery/menu/combos/edit?id=${combo.id}&channel=${channel}`}
                >
                  打开配置
                </Link>
              </div>
            ))}
            {comboItems && comboItems.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                暂无数据
              </div>
            )}
            {comboItems === null && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                加载中...
              </div>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

export default function AdminDeliveryPage() {
  return (
    <Suspense fallback={null}>
      <AdminDeliveryPageContent />
    </Suspense>
  );
}
