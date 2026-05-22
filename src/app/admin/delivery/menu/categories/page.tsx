"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AdminConfirmModal } from "@/components/admin-confirm-modal";
import { BouncyActionButton } from "@/components/bouncy-action-button";
import {
  deleteOfficialMenuCategory,
  fetchOfficialMenuCategories,
  reorderOfficialMenuCategories,
  type OfficialMenuCategory,
} from "@/lib/admin/official-delivery";

function DeliveryMenuCategoriesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "delivery";
  const [rows, setRows] = useState<OfficialMenuCategory[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [sorting, setSorting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OfficialMenuCategory | null>(null);
  const [tip, setTip] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchOfficialMenuCategories().then((data) => {
      if (!active) return;
      setRows(data);
    });
    return () => {
      active = false;
    };
  }, []);

  const moveRow = (list: OfficialMenuCategory[], fromId: string, toId: string) => {
    const fromIndex = list.findIndex((x) => x.id === fromId);
    const toIndex = list.findIndex((x) => x.id === toId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return list;
    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next.map((x, idx) => ({ ...x, sort: idx + 1 }));
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">类目管理</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">管理类目名称、状态、营业时段，支持拖拽排序。</p>
          </div>
          <BouncyActionButton
            success={creating}
            disabled={creating}
            icon={<span className="material-symbols-outlined text-base">add</span>}
            successIcon={<span className="material-symbols-outlined text-base">done</span>}
            label="新增类目"
            successLabel="创建中..."
            onClick={() => {
              if (creating) return;
              setCreating(true);
              router.push(`/admin/delivery/menu/categories/edit?new=1&channel=${channel}`);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          />
        </div>
        {tip ? <p className="mt-3 text-xs font-bold text-primary">{tip}</p> : null}
      </section>

      <section className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-xl font-black">类目列表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3">排序</th>
                <th className="px-5 py-3">类目</th>
                <th className="px-5 py-3">营业时段</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((cat, index) => (
                <tr
                  key={cat.id}
                  draggable={!sorting}
                  onDragStart={() => setDraggingId(cat.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={async () => {
                    if (!rows || !draggingId || draggingId === cat.id || sorting) return;
                    const snapshot = rows;
                    const next = moveRow(rows, draggingId, cat.id);
                    setRows(next);
                    setDraggingId(null);
                    setSorting(true);
                    const result = await reorderOfficialMenuCategories(next.map((x) => x.id));
                    setSorting(false);
                    if (!result.ok) {
                      setRows(snapshot);
                      setTip(`排序保存失败：${result.message}`);
                      return;
                    }
                    setTip("排序已更新");
                  }}
                  className="border-t border-slate-100 dark:border-slate-800"
                >
                  <td className="px-5 py-3">
                    <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-300">
                      <span className="material-symbols-outlined text-base cursor-pointer">drag_indicator</span>
                      <span>{index + 1}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 font-semibold">{cat.name}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-300">{cat.availability}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{cat.is_active ? "已上架" : "草稿"}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/delivery/menu/categories/edit?id=${cat.id}&channel=${channel}`}
                        className="rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                      >
                        编辑
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(cat)}
                        className="rounded-md border border-red-300 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows && rows.length === 0 && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={5}>
                    暂无数据
                  </td>
                </tr>
              )}
              {rows === null && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={5}>
                    加载中...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <AdminConfirmModal
        open={Boolean(confirmDelete)}
        title={confirmDelete ? `确认删除「${confirmDelete.name}」吗？` : "确认删除"}
        description="删除后不可恢复，且可能影响已绑定该类目的单品。"
        confirmLabel="确认删除"
        loading={Boolean(deletingId)}
        onCancel={() => {
          if (deletingId) return;
          setConfirmDelete(null);
        }}
        onConfirm={async () => {
          if (!confirmDelete || deletingId) return;
          setDeletingId(confirmDelete.id);
          const result = await deleteOfficialMenuCategory(confirmDelete.id);
          setDeletingId(null);
          if (!result.ok) {
            setTip(`删除失败：${result.message}`);
            return;
          }
          setRows((prev) => (prev ?? []).filter((x) => x.id !== confirmDelete.id));
          setConfirmDelete(null);
          setTip("已删除类目");
        }}
      />
    </div>
  );
}

export default function DeliveryMenuCategoriesPage() {
  return (
    <Suspense fallback={null}>
      <DeliveryMenuCategoriesPageContent />
    </Suspense>
  );
}
