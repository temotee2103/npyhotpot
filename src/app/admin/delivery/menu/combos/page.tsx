"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { fetchOfficialMenuCategories, fetchOfficialMenuItems, type OfficialMenuCategory, type OfficialMenuItem } from "@/lib/admin/official-delivery";
import { BouncyActionButton } from "@/components/bouncy-action-button";

function DeliveryMenuCombosPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "delivery";
  const [categories, setCategories] = useState<OfficialMenuCategory[] | null>(null);
  const [combos, setCombos] = useState<OfficialMenuItem[] | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([fetchOfficialMenuCategories(), fetchOfficialMenuItems("combo")]).then(([cats, rows]) => {
      if (!active) return;
      setCategories(cats);
      setCombos(rows);
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

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">套餐管理</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">管理套餐结构、组件编排、必选/可选加购与价格策略。</p>
          </div>
          <BouncyActionButton
            success={creating}
            disabled={creating}
            icon={<span className="material-symbols-outlined text-base">add</span>}
            successIcon={<span className="material-symbols-outlined text-base">done</span>}
            label="新增套餐"
            successLabel="创建中..."
            onClick={() => {
              if (creating) return;
              setCreating(true);
              router.push(`/admin/delivery/menu/combos/edit?new=1&channel=${channel}`);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-xl font-black">套餐列表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3">套餐</th>
                <th className="px-5 py-3">类目</th>
                <th className="px-5 py-3">基础价</th>
                <th className="px-5 py-3">营业时段</th>
                <th className="px-5 py-3">月销</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {(combos ?? []).map((combo) => (
                <tr key={combo.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3 font-semibold">{combo.name}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-300">
                    {combo.official_menu_categories?.name ?? categoryName(combo.category_id)}
                  </td>
                  <td className="px-5 py-3">RM {Number(combo.base_price).toFixed(2)}</td>
                  <td className="px-5 py-3">-</td>
                  <td className="px-5 py-3">-</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{combo.is_active ? "上架" : "草稿"}</span>
                  </td>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/delivery/menu/combos/edit?id=${combo.id}&channel=${channel}`}
                      className="rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                    >
                      配置
                    </Link>
                  </td>
                </tr>
              ))}
              {combos && combos.length === 0 && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={7}>
                    暂无数据
                  </td>
                </tr>
              )}
              {combos === null && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={7}>
                    加载中...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default function DeliveryMenuCombosPage() {
  return (
    <Suspense fallback={null}>
      <DeliveryMenuCombosPageContent />
    </Suspense>
  );
}
