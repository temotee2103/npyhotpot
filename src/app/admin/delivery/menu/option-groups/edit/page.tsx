"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createOfficialMenuOptionGroupDraft,
  fetchOfficialMenuItems,
  fetchOfficialMenuOptionGroupById,
  updateOfficialMenuOptionGroup,
  type OfficialMenuItem,
  type OfficialMenuOptionGroup,
} from "@/lib/admin/official-delivery";

function toOptionRows(source: Array<{ name: string; priceDelta: number }>) {
  if (source.length === 0) return [{ itemId: "", name: "", priceDelta: "0" }];
  return source.map((opt) => ({ itemId: "", name: opt.name, priceDelta: String(opt.priceDelta) }));
}

function DeliveryMenuOptionGroupEditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "delivery";
  const id = searchParams.get("id") || "";
  const isCreating = searchParams.get("new") === "1";
  const [loaded, setLoaded] = useState<OfficialMenuOptionGroup | null>(null);
  const [availableItems, setAvailableItems] = useState<OfficialMenuItem[] | null>(null);

  const fallback = useMemo(
    () => ({
      id,
      name: id ? "未找到该组" : "新规格组",
      required: false,
      minSelect: 0,
      maxSelect: 1,
      status: "草稿" as const,
      options: [],
    }),
    [id],
  );

  const group = loaded
    ? {
        id: loaded.id,
        name: loaded.name,
        required: loaded.required,
        minSelect: loaded.min_select,
        maxSelect: loaded.max_select,
        status: loaded.is_active ? ("已上架" as const) : ("草稿" as const),
        options:
          (loaded.official_menu_option_options ?? []).map((o) => ({
            name: o.name,
            priceDelta: Number(o.price_delta),
          })) ?? [],
      }
    : fallback;

  const [name, setName] = useState(group.name);
  const [required, setRequired] = useState(group.required);
  const [minSelect, setMinSelect] = useState(String(group.minSelect));
  const [maxSelect, setMaxSelect] = useState(String(group.maxSelect));
  const [status, setStatus] = useState(group.status);
  const [saved, setSaved] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);
  const [optionRows, setOptionRows] = useState<Array<{ itemId: string; name: string; priceDelta: string }>>(toOptionRows(fallback.options));

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchOfficialMenuOptionGroupById(id).then((data) => {
      if (!active || !data) return;
      setLoaded(data);
      setName(data.name);
      setRequired(data.required);
      setMinSelect(String(data.min_select));
      setMaxSelect(String(data.max_select));
      setStatus(data.is_active ? "已上架" : "草稿");
      setSaved(null);
      setOptionRows(
        toOptionRows(
          (data.official_menu_option_options ?? []).map((o) => ({
            name: o.name,
            priceDelta: Number(o.price_delta),
          })),
        ),
      );
    });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    fetchOfficialMenuItems("ala_carte").then((rows) => {
      if (!active) return;
      setAvailableItems(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  const itemNameById = useMemo(() => {
    return new Map((availableItems ?? []).map((item) => [item.id, item.name]));
  }, [availableItems]);

  const previewOptions = useMemo(() => {
    return optionRows
      .map((row) => ({
        name: row.name.trim() || itemNameById.get(row.itemId) || "",
        priceDelta: Number(row.priceDelta),
      }))
      .filter((row) => row.name)
      .map((row) => ({ name: row.name, priceDelta: Number.isFinite(row.priceDelta) ? row.priceDelta : 0 }));
  }, [itemNameById, optionRows]);

  const hint = useMemo(() => {
    const min = Number(minSelect);
    const max = Number(maxSelect);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return "请选择有效的最小/最大选择数。";
    if (min > max) return "最小选择数不能大于最大选择数。";
    if (required && min < 1) return "必选组建议最小选择数 ≥ 1。";
    return "规则设置正常。";
  }, [minSelect, maxSelect, required]);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">规格组</p>
            <h1 className="mt-1 text-3xl font-black">{group.name}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">定义选择规则和每个选项的加价，用于单品或套餐。</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/delivery/menu/option-groups?channel=${channel}`}
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
                    setSaved("缺少规格组ID");
                    return;
                  }
                  const created = await createOfficialMenuOptionGroupDraft();
                  if (!created) {
                    setSaving(false);
                    setSaved("创建失败，请重试");
                    return;
                  }
                  targetId = created.id;
                }
                const result = await updateOfficialMenuOptionGroup({
                  id: targetId,
                  name,
                  required,
                  minSelect,
                  maxSelect,
                  isActive: status === "已上架",
                  options: previewOptions,
                });
                setSaving(false);
                if (!result.ok) {
                  setSaved(`保存失败：${result.message}`);
                  return;
                }
                router.push(`/admin/delivery/menu/option-groups?channel=${channel}`);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
        {saved && <p className="mt-3 text-xs font-bold text-primary">{saved}</p>}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">规则设置</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">名称</p>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">最小选择数</p>
              <input
                value={minSelect}
                onChange={(event) => setMinSelect(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                inputMode="numeric"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">最大选择数</p>
              <input
                value={maxSelect}
                onChange={(event) => setMaxSelect(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                inputMode="numeric"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">必选</p>
              <button
                type="button"
                onClick={() => setRequired((prev) => !prev)}
                className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${
                  required
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                <span className="material-symbols-outlined text-base">{required ? "check_circle" : "radio_button_unchecked"}</span>
                {required ? "必选" : "可选"}
              </button>
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
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p className="font-bold">提示</p>
            <p className="mt-2 text-slate-500 dark:text-slate-300">{hint}</p>
          </div>
        </article>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">选项列表</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">一行一个选项，名称和加价分别填写。</p>
          <div className="mt-4 space-y-2">
            {optionRows.map((row, index) => (
              <div key={index} className="grid grid-cols-[180px_1fr_120px_auto] items-center gap-2">
                <select
                  value={row.itemId}
                  onChange={(event) => {
                    const nextItemId = event.target.value;
                    const pickedName = itemNameById.get(nextItemId) || "";
                    setOptionRows((prev) =>
                      prev.map((item, i) =>
                        i === index ? { ...item, itemId: nextItemId, name: nextItemId ? pickedName : item.name } : item,
                      ),
                    );
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="">自定义</option>
                  {(availableItems ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <input
                  value={row.name}
                  onChange={(event) =>
                    setOptionRows((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)),
                    )
                  }
                  placeholder="选项名称（可覆盖单品名）"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
                <input
                  value={row.priceDelta}
                  onChange={(event) =>
                    setOptionRows((prev) =>
                      prev.map((item, i) => (i === index ? { ...item, priceDelta: event.target.value } : item)),
                    )
                  }
                  placeholder="加价"
                  inputMode="decimal"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
                <button
                  type="button"
                  disabled={optionRows.length <= 1}
                  onClick={() => setOptionRows((prev) => prev.filter((_, i) => i !== index))}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  删除
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setOptionRows((prev) => [...prev, { itemId: "", name: "", priceDelta: "0" }])}
              className="mt-2 rounded-lg border border-primary/30 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10"
            >
              新增一行
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <p className="text-sm font-bold">预览</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {previewOptions.length === 0 ? (
                <span className="text-sm text-slate-500 dark:text-slate-300">暂无</span>
              ) : (
                previewOptions.map((opt) => (
                  <span key={opt.name} className="rounded-full bg-white px-2 py-1 text-xs font-semibold dark:bg-slate-700">
                    {opt.name}
                    {opt.priceDelta ? ` +RM${opt.priceDelta}` : ""}
                  </span>
                ))
              )}
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

export default function DeliveryMenuOptionGroupEditPage() {
  return (
    <Suspense fallback={null}>
      <DeliveryMenuOptionGroupEditPageContent />
    </Suspense>
  );
}
