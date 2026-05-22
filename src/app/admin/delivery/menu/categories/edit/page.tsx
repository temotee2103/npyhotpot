"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createOfficialMenuCategoryDraft,
  fetchOfficialMenuCategoryById,
  updateOfficialMenuCategory,
  type OfficialMenuCategory,
} from "@/lib/admin/official-delivery";

function parseAvailabilityRange(raw: string): { start: string; end: string } | null {
  const text = raw.trim();
  const match = text.match(/^([01]?\d|2[0-3])[:.]([0-5]\d)\s*-\s*([01]?\d|2[0-3])[:.]([0-5]\d)$/);
  if (!match) return null;
  const startHour = String(Number.parseInt(match[1], 10)).padStart(2, "0");
  const endHour = String(Number.parseInt(match[3], 10)).padStart(2, "0");
  return {
    start: `${startHour}:${match[2]}`,
    end: `${endHour}:${match[4]}`,
  };
}

function DeliveryMenuCategoryEditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "delivery";
  const id = searchParams.get("id") || "";
  const isCreating = searchParams.get("new") === "1";

  const [row, setRow] = useState<OfficialMenuCategory | null>(null);

  const fallback = useMemo(
    () => ({
      id,
      name: id ? "未找到该类目" : "新类目",
      sort: 0,
      availability: "11:00 - 00:00",
      is_active: false,
    }),
    [id],
  );

  const source = row ?? fallback;
  const sourceRange = parseAvailabilityRange(source.availability) ?? { start: "11:00", end: "00:00" };

  const [name, setName] = useState(source.name);
  const [status, setStatus] = useState<"已上架" | "草稿">(source.is_active ? "已上架" : "草稿");
  const [openTime, setOpenTime] = useState(sourceRange.start);
  const [closeTime, setCloseTime] = useState(sourceRange.end);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchOfficialMenuCategoryById(id).then((data) => {
      if (!active || !data) return;
      setRow(data);
      setName(data.name);
      setStatus(data.is_active ? "已上架" : "草稿");
      const nextRange = parseAvailabilityRange(data.availability) ?? { start: "11:00", end: "00:00" };
      setOpenTime(nextRange.start);
      setCloseTime(nextRange.end);
      setSaved(null);
    });
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">MENU CATEGORY</p>
            <h1 className="mt-1 text-3xl font-black">{source.name}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              排序 {source.sort} · {source.is_active ? "已上架" : "草稿"} · ID {source.id || "-"}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/delivery/menu/categories?channel=${channel}`}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
            >
              返回列表
            </Link>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                if (saving) return;
                setSaving(true);
                setSaved(null);
                let targetId = id;
                if (!targetId) {
                  if (!isCreating) {
                    setSaving(false);
                    setSaved("缺少类目ID");
                    return;
                  }
                  const created = await createOfficialMenuCategoryDraft();
                  if (!created) {
                    setSaving(false);
                    setSaved("创建失败，请重试");
                    return;
                  }
                  targetId = created.id;
                }
                const result = await updateOfficialMenuCategory({
                  id: targetId,
                  name,
                  sort: String(source.sort || 0),
                  availability: `${openTime} - ${closeTime}`,
                  isActive: status === "已上架",
                });
                setSaving(false);
                if (!result.ok) {
                  setSaved(`保存失败：${result.message}`);
                  return;
                }
                router.push(`/admin/delivery/menu/categories?channel=${channel}`);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
        {saved ? <p className="mt-3 text-xs font-bold text-primary">{saved}</p> : null}
      </section>

      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h2 className="text-xl font-black">基础信息</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">类目名称</p>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">状态</p>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <option value="已上架">已上架</option>
              <option value="草稿">草稿</option>
            </select>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-300">营业时段</p>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <input
                type="time"
                value={openTime}
                onChange={(event) => setOpenTime(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
              <span className="text-xs font-bold text-slate-500 dark:text-slate-300">至</span>
              <input
                type="time"
                value={closeTime}
                onChange={(event) => setCloseTime(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">统一使用 24 小时制 HH:mm 格式保存。</p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function DeliveryMenuCategoryEditPage() {
  return (
    <Suspense fallback={null}>
      <DeliveryMenuCategoryEditPageContent />
    </Suspense>
  );
}
