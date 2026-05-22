"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createOfficialDiscountDraft, deleteOfficialDiscount, fetchOfficialDiscountById, updateOfficialDiscount } from "@/lib/admin/official-shop";
import { AdminConfirmModal } from "@/components/admin-confirm-modal";

function AdminShopDiscountEditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "shop";
  const id = searchParams.get("id") || "";
  const isCreating = searchParams.get("new") === "1";

  const [loaded, setLoaded] = useState<null | {
    id: string;
    code: string;
    title: string;
    status: "enabled" | "disabled";
    discount_type: "percent" | "fixed";
    percent_off: number | null;
    myr_amount_off: number | null;
    sgd_amount_off: number | null;
    myr_min_spend: number | null;
    sgd_min_spend: number | null;
    stackable: boolean;
  }>(null);

  const fallback = useMemo(
    () => ({
      id,
      code: "",
      title: id ? "未找到该优惠券" : "新优惠券",
      status: "停用" as const,
      type: "percent" as const,
      percentOff: 0,
      minSpend: { MYR: 0, SGD: 0 },
      stackable: false,
    }),
    [id],
  );

  const [title, setTitle] = useState(fallback.title);
  const [code, setCode] = useState(fallback.code);
  const [status, setStatus] = useState<"启用" | "停用">(fallback.status);
  const [stackable, setStackable] = useState(fallback.stackable);
  const [type, setType] = useState<"percent" | "fixed">(fallback.type);
  const [percentOff, setPercentOff] = useState(String(fallback.percentOff));
  const [myrOff, setMyrOff] = useState("0");
  const [sgdOff, setSgdOff] = useState("0");
  const [minMyr, setMinMyr] = useState(String(fallback.minSpend.MYR));
  const [minSgd, setMinSgd] = useState(String(fallback.minSpend.SGD));
  const [saved, setSaved] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    fetchOfficialDiscountById(id, "shop").then((data) => {
      if (!active || !data) return;
      setLoaded(data);
      setTitle(data.title);
      setCode(data.code);
      setStatus(data.status === "enabled" ? "启用" : "停用");
      setStackable(data.stackable);
      setType(data.discount_type);
      setPercentOff(String(data.percent_off ?? 0));
      setMyrOff(String(data.myr_amount_off ?? 0));
      setSgdOff(String(data.sgd_amount_off ?? 0));
      setMinMyr(String(data.myr_min_spend ?? 0));
      setMinSgd(String(data.sgd_min_spend ?? 0));
    });
    return () => {
      active = false;
    };
  }, [id]);

  const headerTitle = loaded?.title ?? fallback.title;
  const headerCode = loaded?.code ?? fallback.code;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">DISCOUNT RULE</p>
            <h1 className="mt-1 text-3xl font-black">{headerTitle}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              Code {headerCode} · {status}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/shop/discounts?channel=${channel}`}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
            >
              返回列表
            </Link>
            <button
              type="button"
              disabled={deleting || saving || !id}
              onClick={async () => {
                if (!id || deleting || saving) return;
                setConfirmDeleteOpen(true);
              }}
              className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-700 dark:hover:bg-red-900/20"
            >
              {deleting ? "删除中..." : "删除"}
            </button>
            <button
              type="button"
              disabled={saving || deleting}
              onClick={async () => {
                if (saving || deleting) return;
                setSaving(true);
                setSaved(null);
                let targetId = id;
                if (!targetId) {
                  if (!isCreating) {
                    setSaving(false);
                    setSaved("缺少优惠券ID");
                    return;
                  }
                  const created = await createOfficialDiscountDraft("shop");
                  if (!created) {
                    setSaving(false);
                    setSaved("创建失败，请重试");
                    return;
                  }
                  targetId = created.id;
                }
                const result = await updateOfficialDiscount({
                  id: targetId,
                  channel: "shop",
                  title,
                  code,
                  status: status === "启用" ? "enabled" : "disabled",
                  stackable,
                  discount_type: type,
                  percent_off: percentOff,
                  myr_amount_off: myrOff,
                  sgd_amount_off: sgdOff,
                  myr_min_spend: minMyr,
                  sgd_min_spend: minSgd,
                });
                setSaving(false);
                if (!result.ok) {
                  setSaved(`保存失败：${result.message}`);
                  return;
                }
                setSaved(`已保存：${new Date().toLocaleTimeString()}`);
                router.push(`/admin/shop/discounts?channel=${channel}&t=${Date.now()}`);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
        {saved && <p className="mt-3 text-xs font-bold text-primary">{saved}</p>}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">基础信息</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">标题</p>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">Code</p>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
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
                <option value="启用">启用</option>
                <option value="停用">停用</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">可叠加</p>
              <button
                type="button"
                onClick={() => setStackable((prev) => !prev)}
                className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${
                  stackable
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                <span className="material-symbols-outlined text-base">{stackable ? "check_circle" : "radio_button_unchecked"}</span>
                {stackable ? "可叠加" : "不可叠加"}
              </button>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">优惠规则</h2>
          <div className="mt-4 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setType("percent")}
                className={`rounded-xl border p-3 text-left transition ${
                  type === "percent"
                    ? "border-primary bg-primary/10"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60"
                }`}
              >
                <p className="font-bold">百分比折扣</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">按订单金额比例减免</p>
              </button>
              <button
                type="button"
                onClick={() => setType("fixed")}
                className={`rounded-xl border p-3 text-left transition ${
                  type === "fixed"
                    ? "border-primary bg-primary/10"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60"
                }`}
              >
                <p className="font-bold">固定金额</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">MYR/SGD 可不同</p>
              </button>
            </div>

            {type === "percent" ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-300">折扣比例（%）</p>
                <input
                  value={percentOff}
                  onChange={(event) => setPercentOff(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                  inputMode="decimal"
                />
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-300">MYR 减免金额</p>
                  <input
                    value={myrOff}
                    onChange={(event) => setMyrOff(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                    inputMode="decimal"
                  />
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-xs font-bold text-slate-500 dark:text-slate-300">SGD 减免金额</p>
                  <input
                    value={sgdOff}
                    onChange={(event) => setSgdOff(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                    inputMode="decimal"
                  />
                </div>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-300">MYR 最低消费</p>
                <input
                  value={minMyr}
                  onChange={(event) => setMinMyr(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                  inputMode="decimal"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-300">SGD 最低消费</p>
                <input
                  value={minSgd}
                  onChange={(event) => setMinSgd(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>
        </article>
      </section>

      <AdminConfirmModal
        open={confirmDeleteOpen}
        title={`确定删除优惠券「${headerTitle}」？`}
        description="删除后不可恢复，优惠规则将被移除。"
        loading={deleting}
        onCancel={() => {
          if (deleting) return;
          setConfirmDeleteOpen(false);
        }}
        onConfirm={async () => {
          if (!id || deleting) return;
          setDeleting(true);
          setSaved(null);
          const result = await deleteOfficialDiscount(id, "shop");
          setDeleting(false);
          if (!result.ok) {
            setSaved(`删除失败：${result.message}`);
            return;
          }
          setConfirmDeleteOpen(false);
          router.push(`/admin/shop/discounts?channel=${channel}&t=${Date.now()}`);
        }}
      />
    </div>
  );
}

export default function AdminShopDiscountEditPage() {
  return (
    <Suspense fallback={null}>
      <AdminShopDiscountEditPageContent />
    </Suspense>
  );
}
