"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  deleteOfficialBundle,
  fetchOfficialBundleById,
  fetchOfficialBundleItems,
  fetchOfficialSoupPackVariants,
  updateOfficialBundle,
  type OfficialSoupPackVariant,
} from "@/lib/admin/official-shop";
import { AdminConfirmModal } from "@/components/admin-confirm-modal";
import { AdminFilePicker } from "@/components/admin-file-picker";
import { supabase } from "@/lib/supabase";

function AdminShopBundleEditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const channel = searchParams.get("channel") || "shop";
  const id = searchParams.get("id") || "";

  const [loaded, setLoaded] = useState<null | {
    id: string;
    code: string;
    title: string;
    status: "draft" | "active";
    rule_kind: "buy_x_get_y" | "fixed_bundle";
    buy_qty: number | null;
    free_qty: number | null;
    pricing_mode: "auto" | "manual";
    myr_price: number | null;
    sgd_price: number | null;
    tags: string[];
  }>(null);

  const fallback = useMemo(
    () => ({
      id,
      code: id || "-",
      title: id ? "未找到该 Bundle" : "请选择 Bundle",
      status: "草稿" as const,
      rule: { kind: "buy_x_get_y" as const, buyQty: 0, freeQty: 0 },
      pricing: { mode: "auto" as const, prices: { MYR: 0, SGD: 0 } },
      tags: [] as string[],
    }),
    [id],
  );

  const [title, setTitle] = useState(fallback.title);
  const [code, setCode] = useState(fallback.code);
  const [imageUrl, setImageUrl] = useState("");
  const [status, setStatus] = useState<"上架" | "草稿">("草稿");
  const [mode, setMode] = useState<"buy_x_get_y" | "fixed_bundle">(fallback.rule.kind);
  const [buyQty, setBuyQty] = useState(String(fallback.rule.buyQty));
  const [freeQty, setFreeQty] = useState(String(fallback.rule.freeQty));
  const [pricingMode, setPricingMode] = useState<"auto" | "manual">(fallback.pricing.mode);
  const [manualMyr, setManualMyr] = useState(String(fallback.pricing.prices?.MYR ?? 0));
  const [manualSgd, setManualSgd] = useState(String(fallback.pricing.prices?.SGD ?? 0));
  const [variants, setVariants] = useState<OfficialSoupPackVariant[] | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const fixedInitial = {};
  const [qtyByProductId, setQtyByProductId] = useState<Record<string, number>>(fixedInitial);
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([fetchOfficialBundleById(id), fetchOfficialSoupPackVariants(), fetchOfficialBundleItems(id)]).then(([bundle, variants, items]) => {
      if (!active) return;
      if (bundle) {
        setLoaded(bundle);
        setTitle(bundle.title);
        setCode(bundle.code);
        setImageUrl(bundle.image_url ?? "");
        setStatus(bundle.status === "active" ? "上架" : "草稿");
        setMode(bundle.rule_kind);
        setBuyQty(String(bundle.buy_qty ?? 0));
        setFreeQty(String(bundle.free_qty ?? 0));
        setPricingMode(bundle.pricing_mode);
        setManualMyr(String(bundle.myr_price ?? 0));
        setManualSgd(String(bundle.sgd_price ?? 0));
      }
      setVariants(variants);
      const next: Record<string, number> = {};
      for (const it of items) next[it.variant_id] = it.quantity;
      setQtyByProductId(next);
      setSelectedVariantIds(Object.keys(next).filter((variantId) => (next[variantId] ?? 0) > 0));
    });
    return () => {
      active = false;
    };
  }, [id]);

  const selectedProducts = useMemo(() => {
    return Object.entries(qtyByProductId)
      .filter(([, qty]) => qty > 0)
      .map(([variantId, qty]) => ({ variant: (variants ?? []).find((v) => v.id === variantId) ?? null, qty }))
      .filter((row): row is { variant: OfficialSoupPackVariant; qty: number } => Boolean(row.variant));
  }, [qtyByProductId, variants]);

  const selectedVariants = useMemo(() => {
    const map = new Map((variants ?? []).map((v) => [v.id, v]));
    return selectedVariantIds.map((id) => map.get(id)).filter(Boolean) as OfficialSoupPackVariant[];
  }, [selectedVariantIds, variants]);

  const totalPackCount = useMemo(() => {
    const buy = Number.parseInt(buyQty, 10);
    const free = Number.parseInt(freeQty, 10);
    const b = Number.isFinite(buy) ? Math.max(0, buy) : 0;
    const f = Number.isFinite(free) ? Math.max(0, free) : 0;
    return b + f;
  }, [buyQty, freeQty]);

  const autoPricePreview = useMemo(() => {
    if (mode === "buy_x_get_y") {
      const buy = Number.parseInt(buyQty, 10);
      const buyCount = Number.isFinite(buy) ? Math.max(0, buy) : 0;
      const maxMyr = selectedVariants.reduce((m, v) => Math.max(m, v.prices.MYR ?? 0), 0);
      const maxSgd = selectedVariants.reduce((m, v) => Math.max(m, v.prices.SGD ?? 0), 0);
      return { myr: maxMyr * buyCount, sgd: maxSgd * buyCount };
    }

    const myr = selectedProducts.reduce((sum, row) => sum + (row.variant.prices.MYR ?? 0) * row.qty, 0);
    const sgd = selectedProducts.reduce((sum, row) => sum + (row.variant.prices.SGD ?? 0) * row.qty, 0);
    return { myr, sgd };
  }, [buyQty, mode, selectedProducts, selectedVariants]);

  const estimatedWeightKg = useMemo(() => {
    if (mode === "buy_x_get_y") {
      const maxWeight = selectedVariants.reduce((m, v) => Math.max(m, Number(v.weight_kg ?? 0)), 0);
      return maxWeight * totalPackCount;
    }
    return selectedProducts.reduce((sum, row) => sum + Number(row.variant.weight_kg ?? 0) * row.qty, 0);
  }, [mode, selectedProducts, selectedVariants, totalPackCount]);

  const setQty = (productId: string, qty: number) => {
    setQtyByProductId((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[productId];
      else next[productId] = qty;
      return next;
    });
  };

  const toggleVariant = (variantId: string) => {
    setSelectedVariantIds((prev) => (prev.includes(variantId) ? prev.filter((id) => id !== variantId) : [...prev, variantId]));
  };

  const [saved, setSaved] = useState<null | string>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">BUNDLE SET</p>
            <h1 className="mt-1 text-3xl font-black">{loaded?.title ?? fallback.title}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">Code {loaded?.code ?? fallback.code} · {status}</p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/admin/shop/bundles?channel=${channel}`}
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
              disabled={saving || deleting || !id}
              onClick={async () => {
                if (!id || saving || deleting) return;
                setSaving(true);
                setSaved(null);
                const itemsByVariantId =
                  mode === "buy_x_get_y"
                    ? Object.fromEntries(selectedVariantIds.map((id) => [id, 1]))
                    : qtyByProductId;
                const result = await updateOfficialBundle({
                  id,
                  code,
                  title,
                  imageUrl,
                  status: status === "上架" ? "active" : "draft",
                  rule_kind: mode,
                  buy_qty: buyQty,
                  free_qty: freeQty,
                  pricing_mode: pricingMode,
                  myr_price: manualMyr,
                  sgd_price: manualSgd,
                  tags: loaded?.tags ?? [],
                  itemsByVariantId,
                });
                setSaving(false);
                if (!result.ok) {
                  setSaved(`保存失败：${result.message}`);
                  return;
                }
                setSaved(`已保存：${new Date().toLocaleTimeString()}`);
                router.push(`/admin/shop/bundles?channel=${channel}&t=${Date.now()}`);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
        {saved && <p className="mt-3 text-xs font-bold text-primary">{saved}</p>}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">基础设置</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">Bundle 名称</p>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">Code</p>
              <input
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">Bundle 主图</p>
              <AdminFilePicker
                className="mt-2"
                onSelect={async (files) => {
                  const file = files[0];
                  if (!file || !id || !supabase) return;
                  const ext = file.name.split(".").pop() || "jpg";
                  const path = `bundles/${id}/${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
                  if (error) return;
                  const { data } = supabase.storage.from("media").getPublicUrl(path);
                  setImageUrl(data.publicUrl);
                }}
              />
              {imageUrl ? (
                <div className="mt-2 rounded-xl border border-slate-200 p-2 dark:border-slate-700">
                  <Image src={imageUrl} alt="预览" width={128} height={128} className="h-32 w-32 rounded-lg object-cover" unoptimized />
                </div>
              ) : null}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">状态</p>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as typeof status)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="上架">上架</option>
                <option value="草稿">草稿</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">规则类型</p>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as typeof mode)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="buy_x_get_y">买X送Y</option>
                <option value="fixed_bundle">自选组合（客制化）</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">买数量</p>
              <input
                value={buyQty}
                onChange={(event) => setBuyQty(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                inputMode="numeric"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">送数量</p>
              <input
                value={freeQty}
                onChange={(event) => setFreeQty(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                inputMode="numeric"
              />
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">定价</h2>
          <div className="mt-4 space-y-3">
            <div>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-300">计价模式</p>
              <select
                value={pricingMode}
                onChange={(event) => setPricingMode(event.target.value as typeof pricingMode)}
                className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <option value="auto">自动（按单品汇总）</option>
                <option value="manual">手动（促销价）</option>
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-300">手动 MYR</p>
                <input
                  value={manualMyr}
                  onChange={(event) => setManualMyr(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  inputMode="decimal"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-300">手动 SGD</p>
                <input
                  value={manualSgd}
                  onChange={(event) => setManualSgd(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  inputMode="decimal"
                />
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-800/60">
              <p className="font-bold">自动计价预览</p>
              <p className="mt-2 text-slate-500 dark:text-slate-300">MYR: RM {autoPricePreview.myr.toFixed(2)} · SGD: S$ {autoPricePreview.sgd.toFixed(2)}</p>
            </div>
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h2 className="text-xl font-black">组合内容</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
          {mode === "buy_x_get_y"
            ? "选择参与活动的商品（仅勾选）。顾客下单时自行分配数量，总数 = 买 + 送。"
            : "选择参与 Bundle 的汤包 SKU，并设置每个 SKU 数量。"}
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(variants ?? []).map((product) => {
            const qty = qtyByProductId[product.id] ?? 0;
            const checked = selectedVariantIds.includes(product.id);
            return (
              <div key={product.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 max-w-[70%]">
                    <p
                      className="font-bold"
                      style={{
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                      title={product.title}
                    >
                      {product.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      RM {(product.prices.MYR ?? 0).toFixed(2)} · S$ {(product.prices.SGD ?? 0).toFixed(2)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">Weight: {Number(product.weight_kg ?? 0).toFixed(3)} kg</p>
                  </div>
                  {mode === "buy_x_get_y" ? (
                    <button
                      type="button"
                      onClick={() => toggleVariant(product.id)}
                      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${
                        checked
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"
                      }`}
                    >
                      <span className="material-symbols-outlined text-base">{checked ? "check_circle" : "radio_button_unchecked"}</span>
                      {checked ? "已选择" : "选择"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="h-8 w-8 rounded-md border border-primary/40 text-sm font-black text-primary hover:bg-primary/10"
                        onClick={() => setQty(product.id, Math.max(0, qty - 1))}
                      >
                        -
                      </button>
                      <div className="w-8 text-center text-sm font-bold">{qty}</div>
                      <button
                        type="button"
                        className="h-8 w-8 rounded-md border border-primary/40 text-sm font-black text-primary hover:bg-primary/10"
                        onClick={() => setQty(product.id, qty + 1)}
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {variants && variants.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-300">暂无商品</p>}
          {variants === null && <p className="text-sm text-slate-500 dark:text-slate-300">加载中...</p>}
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-sm font-bold">预览</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
            {mode === "buy_x_get_y" ? `总包数：${totalPackCount}` : "总包数按每个SKU数量汇总"}
            {" · "}
            预估总重：{Number(estimatedWeightKg).toFixed(3)} kg
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {mode === "buy_x_get_y" ? (
              selectedVariants.length === 0 ? (
                <span className="text-sm text-slate-500 dark:text-slate-300">未选择任何商品</span>
              ) : (
                selectedVariants.map((variant) => (
                  <span key={variant.id} className="rounded-full bg-white px-2 py-1 text-xs font-semibold dark:bg-slate-700">
                    {variant.title}
                  </span>
                ))
              )
            ) : selectedProducts.length === 0 ? (
              <span className="text-sm text-slate-500 dark:text-slate-300">未选择任何商品</span>
            ) : (
              selectedProducts.map((row) => (
                <span key={row.variant.id} className="rounded-full bg-white px-2 py-1 text-xs font-semibold dark:bg-slate-700">
                  {row.variant.title} × {row.qty}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      <AdminConfirmModal
        open={confirmDeleteOpen}
        title={`确定删除 Bundle「${loaded?.title ?? title}」？`}
        description="删除后不可恢复，Bundle 配置将被移除。"
        loading={deleting}
        onCancel={() => {
          if (deleting) return;
          setConfirmDeleteOpen(false);
        }}
        onConfirm={async () => {
          if (!id || deleting) return;
          setDeleting(true);
          setSaved(null);
          const result = await deleteOfficialBundle(id);
          setDeleting(false);
          if (!result.ok) {
            setSaved(`删除失败：${result.message}`);
            return;
          }
          setConfirmDeleteOpen(false);
          router.push(`/admin/shop/bundles?channel=${channel}&t=${Date.now()}`);
        }}
      />
    </div>
  );
}

export default function AdminShopBundleEditPage() {
  return (
    <Suspense fallback={null}>
      <AdminShopBundleEditPageContent />
    </Suspense>
  );
}
