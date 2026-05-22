"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { fetchOfficialOrders, type OfficialOrderRow } from "@/lib/admin/official-orders";
import { supabase } from "@/lib/supabase";

export default function AdminShopOrdersPage() {
  const [rows, setRows] = useState<OfficialOrderRow[] | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchOfficialOrders(50).then((data) => {
      if (!active) return;
      setRows(data.filter((o) => o.channel === "shop"));
    });
    return () => {
      active = false;
    };
  }, []);

  const formatMoney = useMemo(() => {
    return (currency: "MYR" | "SGD", amount: number) => `${currency === "SGD" ? "S$" : "RM"} ${Number(amount).toFixed(2)}`;
  }, []);

  const buildBestExpressRows = async (orders: OfficialOrderRow[]) => {
    if (!supabase) return { ok: false as const, message: "Supabase 未初始化" };
    const orderIds = orders.map((o) => o.id);

    const { data: itemRows, error: itemError } = await supabase
      .from("official_order_items")
      .select("order_id,item_type,item_id,title,quantity")
      .in("order_id", orderIds);
    if (itemError) return { ok: false as const, message: itemError.message };

    const bundleIds = Array.from(new Set((itemRows ?? []).filter((it) => it.item_type === "bundle").map((it) => it.item_id)));
    const variantIdsDirect = Array.from(
      new Set((itemRows ?? []).filter((it) => it.item_type === "soup_pack_variant").map((it) => it.item_id)),
    );

    const { data: bundleItemRows, error: bundleError } =
      bundleIds.length === 0
        ? { data: [] as Array<{ bundle_id: string; variant_id: string; quantity: number }>, error: null as unknown as null }
        : await supabase.from("official_soup_pack_bundle_items").select("bundle_id,variant_id,quantity").in("bundle_id", bundleIds);
    if (bundleError) return { ok: false as const, message: bundleError.message };

    const variantIdsFromBundles = Array.from(new Set((bundleItemRows ?? []).map((r) => r.variant_id)));
    const variantIds = Array.from(new Set([...variantIdsDirect, ...variantIdsFromBundles]));

    const { data: variantRows, error: variantError } =
      variantIds.length === 0
        ? { data: [] as Array<{ id: string; weight_kg: number; title: string }>, error: null as unknown as null }
        : await supabase.from("official_soup_pack_variants").select("id,weight_kg,title").in("id", variantIds);
    if (variantError) return { ok: false as const, message: variantError.message };

    const weightByVariantId = new Map<string, number>((variantRows ?? []).map((v) => [v.id, Number(v.weight_kg ?? 0)]));
    const itemsByOrderId = new Map<
      string,
      Array<{ item_type: string; item_id: string; title: string | null; quantity: number }>
    >();
    for (const it of itemRows ?? []) {
      const arr = itemsByOrderId.get(it.order_id) ?? [];
      arr.push({ item_type: it.item_type, item_id: it.item_id, title: it.title ?? null, quantity: Number(it.quantity) });
      itemsByOrderId.set(it.order_id, arr);
    }

    const bundleItemsByBundleId = new Map<string, Array<{ variant_id: string; quantity: number }>>();
    for (const bi of bundleItemRows ?? []) {
      const arr = bundleItemsByBundleId.get(bi.bundle_id) ?? [];
      arr.push({ variant_id: bi.variant_id, quantity: Number(bi.quantity) });
      bundleItemsByBundleId.set(bi.bundle_id, arr);
    }

    const missing = [];
    const aoa: Array<Array<string | number>> = [];

    for (const order of orders) {
      const fullName = (order.ship_full_name ?? order.official_profiles?.full_name ?? "").trim();
      const phone = (order.ship_phone ?? order.official_profiles?.phone ?? "").trim();
      const postcode = (order.ship_postcode ?? "").trim();
      const address = (order.ship_address ?? "").trim();

      if (!fullName || !phone || !postcode || !address) missing.push(order.id);

      const lines = itemsByOrderId.get(order.id) ?? [];
      const remarkParts: string[] = [];
      let weightKg = 0;

      for (const line of lines) {
        if (line.title) remarkParts.push(`${line.title}×${line.quantity}`);
        if (line.item_type === "soup_pack_variant") {
          const w = weightByVariantId.get(line.item_id) ?? 0;
          weightKg += w * line.quantity;
        } else if (line.item_type === "bundle") {
          const bundleItems = bundleItemsByBundleId.get(line.item_id) ?? [];
          for (const bi of bundleItems) {
            const w = weightByVariantId.get(bi.variant_id) ?? 0;
            weightKg += w * bi.quantity * line.quantity;
          }
        }
      }

      const normalizedWeight = Math.max(0.1, Number.isFinite(weightKg) ? weightKg : 0.1);
      const cod = "";
      const coverage = "";
      const orderType = "Parcel";
      const orderName = "Soup Pack";
      const waybill = "";
      const remark = "";

      aoa.push([fullName, phone, postcode, address, cod, coverage, Number(normalizedWeight.toFixed(3)), orderType, orderName, waybill, remark]);
    }

    return { ok: true as const, aoa, missing };
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black">商城订单履约</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">固定邮寄方：Best Express。支持一键导出下单模板。</p>
          </div>
          <button
            disabled={exporting || !rows || rows.length === 0}
            onClick={async () => {
              if (exporting) return;
              const shopOrders = (rows ?? []).filter((o) => o.channel === "shop");
              if (shopOrders.length === 0) return;
              setExporting(true);
              setExportMessage(null);

              const prepared = await buildBestExpressRows(shopOrders);
              if (!prepared.ok) {
                setExportMessage(`导出失败：${prepared.message}`);
                setExporting(false);
                return;
              }

              const resp = await fetch("/templates/best_express_orders.xlsx");
              if (!resp.ok) {
                setExportMessage("导出失败：无法读取 Best Express 模板文件");
                setExporting(false);
                return;
              }

              const templateBuffer = await resp.arrayBuffer();
              const XLSXModule = await import("xlsx");
              const XLSX = (XLSXModule as unknown as { default?: typeof XLSXModule }).default ?? XLSXModule;
              const wb = XLSX.read(templateBuffer, { type: "array" });
              const sheetName = wb.SheetNames[0];
              const ws = wb.Sheets[sheetName];

              XLSX.utils.sheet_add_aoa(ws, prepared.aoa, { origin: { r: 1, c: 0 } });
              const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });

              const blob = new Blob([out], {
                type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              const stamp = new Date().toISOString().slice(0, 19).replaceAll(":", "").replace("T", "_");
              a.href = url;
              a.download = `best_express_orders_${stamp}.xlsx`;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);

              if (prepared.missing.length > 0) {
                setExportMessage(`已导出，但有 ${prepared.missing.length} 笔缺少收件信息（Full name/Phone/Postcode/Address）。`);
              } else {
                setExportMessage("已导出 Best Express 模板文件。");
              }
              setExporting(false);
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {exporting ? "导出中..." : "导出 Best Express"}
          </button>
        </div>
        {exportMessage && <p className="mt-3 text-xs font-bold text-primary">{exportMessage}</p>}
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">待处理</p>
          <p className="mt-2 text-2xl font-black">{rows ? String(rows.filter((o) => o.status === "created").length) : "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">处理中</p>
          <p className="mt-2 text-2xl font-black">{rows ? String(rows.filter((o) => o.status === "fulfilling").length) : "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">已完成</p>
          <p className="mt-2 text-2xl font-black">{rows ? String(rows.filter((o) => o.status === "completed").length) : "-"}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
          <p className="text-xs text-slate-500 dark:text-slate-300">异常订单</p>
          <p className="mt-2 text-2xl font-black">{rows ? String(rows.filter((o) => o.status === "payment_failed").length) : "-"}</p>
        </article>
      </section>

      <section className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <h2 className="text-xl font-black">订单队列</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3">订单号</th>
                <th className="px-5 py-3">用户</th>
                <th className="px-5 py-3">币种</th>
                <th className="px-5 py-3">金额</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((order) => (
                <tr key={order.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3 font-semibold">{order.id}</td>
                  <td className="px-5 py-3">{order.official_profiles?.full_name ?? "-"}</td>
                  <td className="px-5 py-3">{order.currency}</td>
                  <td className="px-5 py-3">{formatMoney(order.currency, order.total)}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{order.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    <Link href={`/admin/shop/orders/detail?id=${order.id}`} className="rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10">
                      查看详情
                    </Link>
                  </td>
                </tr>
              ))}
              {rows && rows.length === 0 && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={6}>
                    暂无数据
                  </td>
                </tr>
              )}
              {rows === null && (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={6}>
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
