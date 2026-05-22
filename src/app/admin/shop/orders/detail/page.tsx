"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchOfficialBundleById, fetchOfficialDiscounts, fetchOfficialSoupPackVariantById } from "@/lib/admin/official-shop";
import { fetchOfficialOrderById, fetchOfficialOrderItems, type OfficialOrderItemRow, type OfficialOrderRow } from "@/lib/admin/official-orders";

function AdminShopOrderDetailPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";

  const [order, setOrder] = useState<OfficialOrderRow | null>(null);
  const [items, setItems] = useState<OfficialOrderItemRow[] | null>(null);
  const [resolvedItemTitles, setResolvedItemTitles] = useState<Record<string, string>>({});
  const [discounts, setDiscounts] = useState<
    Array<{ id: string; code: string; title: string; status: string; discount_type: string; percent_off: number | null }> | null
  >(null);

  const fallback = useMemo(
    () => ({
      id,
      currency: "MYR" as const,
      status: "unknown" as const,
      createdAt: "-",
      subtotal: 0,
      shippingFee: 0,
      discountTotal: 0,
      total: 0,
      couponCode: "",
      customerName: "-",
      customerPhone: "-",
    }),
    [id],
  );

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([fetchOfficialOrderById(id), fetchOfficialOrderItems(id), fetchOfficialDiscounts("shop")]).then(([o, items, discounts]) => {
      if (!active) return;
      setOrder(o);
      setItems(items);
      setDiscounts(discounts);
    });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!items || items.length === 0) return;
    let active = true;
    const run = async () => {
      const variants = items.filter((x) => x.item_type === "soup_pack_variant").map((x) => x.item_id);
      const bundles = items.filter((x) => x.item_type === "bundle").map((x) => x.item_id);
      const uniqueVariants = [...new Set(variants)];
      const uniqueBundles = [...new Set(bundles)];

      const [variantRows, bundleRows] = await Promise.all([
        Promise.all(uniqueVariants.map((variantId) => fetchOfficialSoupPackVariantById(variantId))),
        Promise.all(uniqueBundles.map((bundleId) => fetchOfficialBundleById(bundleId))),
      ]);
      if (!active) return;
      const mapping: Record<string, string> = {};
      uniqueVariants.forEach((variantId, index) => {
        const row = variantRows[index];
        if (row?.title) mapping[variantId] = row.title;
      });
      uniqueBundles.forEach((bundleId, index) => {
        const row = bundleRows[index];
        if (row?.title) mapping[bundleId] = row.title;
      });
      setResolvedItemTitles(mapping);
    };
    void run();
    return () => {
      active = false;
    };
  }, [items]);

  const source = order
    ? {
        id: order.id,
        currency: order.currency,
        status: order.status,
        createdAt: new Date(order.created_at).toLocaleString(),
        subtotal: order.subtotal,
        shippingFee: order.shipping_fee,
        discountTotal: order.discount_total,
        total: order.total,
        couponCode: order.coupon_code ?? "",
        customerName: order.official_profiles?.full_name ?? "-",
        customerPhone: order.official_profiles?.phone ?? "-",
      }
    : fallback;

  const currency = source.currency;
  const formatMoney = useMemo(() => {
    return (amount: number) => `${currency === "SGD" ? "S$" : "RM"} ${Number(amount).toFixed(2)}`;
  }, [currency]);

  const recipientName = (order?.ship_full_name ?? source.customerName ?? "-").trim() || "-";
  const recipientPhone = (order?.ship_phone ?? source.customerPhone ?? "-").trim() || "-";
  const recipientPostcode = (order?.ship_postcode ?? "").trim() || "-";
  const recipientAddress = (order?.ship_address ?? "").trim() || "-";
  const isSameAsCustomer = recipientName === source.customerName && recipientPhone === source.customerPhone;

  const activeCoupons = (discounts ?? []).filter((d) => d.status === "enabled");
  const selectedCoupon = activeCoupons.find((d) => d.code === source.couponCode.trim()) ?? null;
  const sstAmount = source.subtotal * 0.06;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.14em] text-primary">ORDER DETAIL</p>
            <h1 className="mt-1 text-3xl font-black">{source.id}</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">
              {source.currency} · {source.status} · {source.createdAt}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/shop/orders" className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10">
              返回列表
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <article className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="text-xl font-black">订单明细</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(items ?? []).length === 0 ? (
              <div className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300">暂无商品</div>
            ) : (
              (items ?? []).map((line) => {
                const title = line.title ?? resolvedItemTitles[line.item_id] ?? line.item_id;
                const lineTotal = Number(line.unit_price) * line.quantity;
                return (
                  <div key={line.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold">{title}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                          {formatMoney(Number(line.unit_price))} × {line.quantity}
                        </p>
                      </div>
                      <p className="text-sm font-bold">{formatMoney(lineTotal)}</p>
                    </div>
                  </div>
                );
              })
            )}
            {items === null && <div className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300">加载中...</div>}
          </div>
        </article>

        <article className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
              <h2 className="text-xl font-black">客户信息</h2>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-slate-500 dark:text-slate-300">姓名</p>
                  <p className="font-bold">{source.customerName}</p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-slate-500 dark:text-slate-300">电话</p>
                  <p className="font-bold">{source.customerPhone}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
              <h2 className="text-xl font-black">收件信息</h2>
              {isSameAsCustomer ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">收件人信息与客户信息一致。</p> : null}
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-slate-500 dark:text-slate-300">收件人姓名</p>
                  <p className="font-bold">{recipientName}</p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-slate-500 dark:text-slate-300">联系电话</p>
                  <p className="font-bold">{recipientPhone}</p>
                </div>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-slate-500 dark:text-slate-300">Postcode</p>
                  <p className="font-bold">{recipientPostcode}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/60">
                  <p className="text-slate-500 dark:text-slate-300">Address</p>
                  <p className="mt-1 text-sm font-bold leading-relaxed">{recipientAddress}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
            <h2 className="text-xl font-black">价格与折扣</h2>

            <div className="mt-4 space-y-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-xs font-bold text-slate-500 dark:text-slate-300">优惠券（Code）</p>
                <p className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-bold dark:border-slate-700 dark:bg-slate-900/60">
                  {source.couponCode || "不使用"}
                </p>
                {selectedCoupon && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">
                    当前券：{selectedCoupon.discount_type === "percent" ? `${selectedCoupon.percent_off ?? 0}%` : "固定金额"}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
              <div className="flex items-center justify-between text-sm">
                <p className="text-slate-500 dark:text-slate-300">小计</p>
                <p className="font-bold">{formatMoney(source.subtotal)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <p className="text-slate-500 dark:text-slate-300">邮寄费</p>
                <p className="font-bold">{formatMoney(source.shippingFee)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <p className="text-slate-500 dark:text-slate-300">SST 6%</p>
                <p className="font-bold">{formatMoney(sstAmount)}</p>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <p className="text-slate-500 dark:text-slate-300">优惠券</p>
                <p className="font-bold text-primary">- {formatMoney(source.discountTotal)}</p>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 text-base dark:border-slate-700">
                <p className="font-black">应付</p>
                <p className="text-lg font-black text-primary">{formatMoney(source.total)}</p>
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Link
                className="rounded-lg border border-primary/40 px-3 py-2 text-center text-sm font-bold text-primary hover:bg-primary/10"
                href={`/admin/shop/orders/invoice?id=${source.id}`}
              >
                Invoice / 发票
              </Link>
              <Link
                className="rounded-lg bg-primary px-3 py-2 text-center text-sm font-bold text-white hover:bg-primary/90"
                href={`/admin/shop/orders/receipt?id=${source.id}`}
              >
                Receipt / 收据
              </Link>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

export default function AdminShopOrderDetailPage() {
  return (
    <Suspense fallback={null}>
      <AdminShopOrderDetailPageContent />
    </Suspense>
  );
}
