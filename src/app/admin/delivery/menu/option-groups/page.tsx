"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AdminConfirmModal } from "@/components/admin-confirm-modal";
import { BouncyActionButton } from "@/components/bouncy-action-button";
import { deleteOfficialMenuOptionGroup, fetchOfficialMenuOptionGroups, type OfficialMenuOptionGroup } from "@/lib/admin/official-delivery";

function DeliveryMenuOptionGroupsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "delivery";
  const [rows, setRows] = useState<OfficialMenuOptionGroup[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState<OfficialMenuOptionGroup | null>(null);

  useEffect(() => {
    let active = true;
    fetchOfficialMenuOptionGroups().then((data) => {
      if (!active) return;
      setRows(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">规格组管理</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              规格组 / 加料组统一管理：必选/可选、最小/最大选择数、每个选项加价。
            </p>
          </div>
          <BouncyActionButton
            success={creating}
            disabled={creating}
            icon={<span className="material-symbols-outlined text-base">add</span>}
            successIcon={<span className="material-symbols-outlined text-base">done</span>}
            label="新增规格组"
            successLabel="创建中..."
            onClick={() => {
              if (creating) return;
              setCreating(true);
              router.push(`/admin/delivery/menu/option-groups/edit?new=1&channel=${channel}`);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="text-xl font-black">组列表</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3">名称</th>
                <th className="px-5 py-3">规则</th>
                <th className="px-5 py-3">选项数</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((group) => (
                <tr key={group.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3 font-semibold">{group.name}</td>
                  <td className="px-5 py-3 text-slate-500 dark:text-slate-300">
                    {group.required ? "必选" : "可选"} · {group.min_select}-{group.max_select}
                  </td>
                  <td className="px-5 py-3">{(group.official_menu_option_options ?? []).length}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{group.is_active ? "已上架" : "草稿"}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/delivery/menu/option-groups/edit?id=${group.id}&channel=${channel}`}
                        className="rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                      >
                        编辑
                      </Link>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteGroup(group)}
                        className="cursor-pointer rounded-md border border-red-300 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-700 dark:hover:bg-red-900/20"
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
        open={Boolean(confirmDeleteGroup)}
        title={confirmDeleteGroup ? `确认删除「${confirmDeleteGroup.name}」吗？` : "确认删除"}
        description="删除后不可恢复，已绑定该规格组的商品会失去该绑定。"
        confirmLabel="确认删除"
        loading={Boolean(deletingId)}
        onCancel={() => {
          if (deletingId) return;
          setConfirmDeleteGroup(null);
        }}
        onConfirm={async () => {
          if (!confirmDeleteGroup || deletingId) return;
          setDeletingId(confirmDeleteGroup.id);
          const result = await deleteOfficialMenuOptionGroup(confirmDeleteGroup.id);
          setDeletingId(null);
          if (!result.ok) return;
          setRows((prev) => (prev ?? []).filter((x) => x.id !== confirmDeleteGroup.id));
          setConfirmDeleteGroup(null);
        }}
      />
    </div>
  );
}

export default function DeliveryMenuOptionGroupsPage() {
  return (
    <Suspense fallback={null}>
      <DeliveryMenuOptionGroupsPageContent />
    </Suspense>
  );
}
