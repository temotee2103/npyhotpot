"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  deleteOfficialMenuItem,
  fetchOfficialMenuCategories,
  fetchOfficialMenuItems,
  reorderOfficialMenuItems,
  setOfficialMenuItemActiveStatus,
  sortOfficialMenuItemsByCategoryOrder,
  type OfficialMenuCategory,
  type OfficialMenuItem,
} from "@/lib/admin/official-delivery";
import { BouncyActionButton } from "@/components/bouncy-action-button";
import { AdminConfirmModal } from "@/components/admin-confirm-modal";

function DeliveryMenuItemsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "delivery";
  const [categories, setCategories] = useState<OfficialMenuCategory[] | null>(null);
  const [items, setItems] = useState<OfficialMenuItem[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [sorting, setSorting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<OfficialMenuItem | null>(null);
  const [tip, setTip] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([fetchOfficialMenuCategories(), fetchOfficialMenuItems("ala_carte")]).then(([cats, rows]) => {
      if (!active) return;
      setCategories(cats);
      setItems(sortOfficialMenuItemsByCategoryOrder(rows, cats));
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

  const moveRow = (list: OfficialMenuItem[], fromId: string, toId: string) => {
    const fromIndex = list.findIndex((x) => x.id === fromId);
    const toIndex = list.findIndex((x) => x.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list;
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next.map((x, idx) => ({ ...x, sort: idx + 1 }));
  };

  const filteredItems = useMemo(() => {
    const base = items ?? [];
    const byCategory = selectedCategoryId === "all" ? base : base.filter((item) => item.category_id === selectedCategoryId);
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return byCategory;
    return byCategory.filter((item) => {
      const text = [
        item.name,
        item.description ?? "",
        item.official_menu_categories?.name ?? categoryName(item.category_id),
        ...(item.tags ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(normalizedKeyword);
    });
  }, [categoryName, items, keyword, selectedCategoryId]);

  const hasActiveFilters = selectedCategoryId !== "all" || keyword.trim() !== "";

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-amber-200/20 bg-white p-5 shadow-sm dark:border-amber-200/10 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">单品管理</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">管理商品信息、价格、标签与绑定规格组，支持拖拽排序。</p>
          </div>
          <BouncyActionButton
            success={creating}
            disabled={creating}
            icon={<span className="material-symbols-outlined text-base">add</span>}
            successIcon={<span className="material-symbols-outlined text-base">done</span>}
            label="新增单品"
            successLabel="创建中..."
            onClick={async () => {
              if (creating) return;
              setCreating(true);
              router.push(`/admin/delivery/menu/items/edit?new=1&channel=${channel}`);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          />
        </div>
        {tip ? <p className="mt-3 text-xs font-bold text-primary">{tip}</p> : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-amber-200/20 bg-white shadow-sm dark:border-amber-200/10 dark:bg-slate-900/70">
        <div className="border-b border-amber-100/10 px-5 py-4 dark:border-amber-100/10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black">单品列表</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">支持按类目筛选、关键词搜索，并可直接快捷上下架。</p>
            </div>
            <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:min-w-[520px]">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                类目筛选
                <select
                  value={selectedCategoryId}
                  onChange={(event) => setSelectedCategoryId(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="all">全部类目</option>
                  {(categories ?? []).map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                搜索单品
                <input
                  value={keyword}
                  onChange={(event) => setKeyword(event.target.value)}
                  placeholder="搜索名称/描述/标签"
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            </div>
          </div>
          {hasActiveFilters ? (
            <p className="mt-3 text-xs font-bold text-slate-500 dark:text-slate-300">当前为筛选/搜索结果，已暂时关闭拖拽排序。</p>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full table-fixed text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="w-16 px-5 py-3">排序</th>
                <th className="w-[32%] px-5 py-3">商品</th>
                <th className="w-[20%] px-5 py-3">类目</th>
                <th className="w-24 px-5 py-3">价格</th>
                <th className="w-20 px-5 py-3">状态</th>
                <th className="w-48 px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => (
                <tr
                  key={item.id}
                  draggable={!sorting && !hasActiveFilters}
                  onDragStart={() => setDraggingId(item.id)}
                  onDragOver={(event) => {
                    if (hasActiveFilters) return;
                    event.preventDefault();
                  }}
                  onDrop={async () => {
                    if (!items || !draggingId || draggingId === item.id || sorting || hasActiveFilters) return;
                    const draggingItem = items.find((entry) => entry.id === draggingId);
                    if (!draggingItem) return;
                    if ((draggingItem.category_id ?? null) !== (item.category_id ?? null)) {
                      setDraggingId(null);
                      setTip("目前仅支持同类目内拖拽排序");
                      return;
                    }
                    const snapshot = items;
                    const next = moveRow(items, draggingId, item.id);
                    setItems(next);
                    setDraggingId(null);
                    setSorting(true);
                    const result = await reorderOfficialMenuItems(next.map((x) => x.id));
                    setSorting(false);
                    if (!result.ok) {
                      setItems(snapshot);
                      setTip(`排序保存失败：${result.message}`);
                      return;
                    }
                    setTip("排序已更新");
                  }}
                  className="border-t border-amber-100/10 dark:border-amber-100/10"
                >
                  <td className="px-5 py-3">
                    <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-300">
                      <span className={`material-symbols-outlined text-base ${hasActiveFilters ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
                        drag_indicator
                      </span>
                      <span>{index + 1}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-semibold">
                    <p className="line-clamp-2 max-w-[220px] leading-6">{item.name}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-300">
                    <p className="line-clamp-2 max-w-[170px] leading-6">
                      {item.official_menu_categories?.name ?? categoryName(item.category_id)}
                    </p>
                  </td>
                  <td className="px-5 py-3">RM {Number(item.base_price).toFixed(2)}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{item.is_active ? "上架" : "草稿"}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={Boolean(togglingId) || Boolean(deletingId)}
                        onClick={async () => {
                          if (togglingId || deletingId) return;
                          setTogglingId(item.id);
                          const nextActive = !item.is_active;
                          const result = await setOfficialMenuItemActiveStatus(item.id, nextActive);
                          setTogglingId(null);
                          if (!result.ok) {
                            setTip(`状态更新失败：${result.message}`);
                            return;
                          }
                          setItems((prev) =>
                            (prev ?? []).map((entry) => (entry.id === item.id ? { ...entry, is_active: nextActive } : entry)),
                          );
                          setTip(`${item.name} 已${nextActive ? "上架" : "下架"}`);
                        }}
                        className={`inline-flex min-w-[56px] justify-center rounded-md px-3 py-1 text-xs font-bold disabled:opacity-60 ${
                          item.is_active
                            ? "border border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20"
                            : "border border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                        }`}
                      >
                        {togglingId === item.id ? "处理中..." : item.is_active ? "下架" : "上架"}
                      </button>
                      <Link
                        href={`/admin/delivery/menu/items/edit?id=${item.id}&channel=${channel}`}
                        className="inline-flex min-w-[56px] justify-center rounded-md border border-amber-300/50 px-3 py-1 text-xs font-bold text-amber-200 hover:bg-amber-400/10 dark:border-amber-500/40 dark:text-amber-200"
                      >
                        编辑
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteItem(item)}
                        className="inline-flex min-w-[56px] justify-center rounded-md border border-red-300 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {items && filteredItems.length === 0 && (
                <tr className="border-t border-amber-100/10 dark:border-amber-100/10">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={6}>
                    {hasActiveFilters ? "没有符合筛选条件的单品" : "暂无数据"}
                  </td>
                </tr>
              )}
              {items === null && (
                <tr className="border-t border-amber-100/10 dark:border-amber-100/10">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={6}>
                    加载中...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <AdminConfirmModal
        open={Boolean(confirmDeleteItem)}
        title={confirmDeleteItem ? `确认删除「${confirmDeleteItem.name}」吗？` : "确认删除"}
        description="删除后不可恢复，关联的规格绑定会一起移除。"
        confirmLabel="确认删除"
        loading={Boolean(deletingId)}
        onCancel={() => {
          if (deletingId) return;
          setConfirmDeleteItem(null);
        }}
        onConfirm={async () => {
          if (!confirmDeleteItem || deletingId) return;
          setDeletingId(confirmDeleteItem.id);
          const result = await deleteOfficialMenuItem(confirmDeleteItem.id);
          setDeletingId(null);
          if (!result.ok) return;
          setItems((prev) => (prev ?? []).filter((x) => x.id !== confirmDeleteItem.id));
          setConfirmDeleteItem(null);
          setTip("已删除单品");
        }}
      />
    </div>
  );
}

export default function DeliveryMenuItemsPage() {
  return (
    <Suspense fallback={null}>
      <DeliveryMenuItemsPageContent />
    </Suspense>
  );
}
