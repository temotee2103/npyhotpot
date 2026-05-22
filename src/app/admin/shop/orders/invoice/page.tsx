"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { fetchOfficialBundleById, fetchOfficialSoupPackVariantById } from "@/lib/admin/official-shop";
import { fetchOfficialInvoiceByOrderId, type OfficialInvoiceRow } from "@/lib/admin/official-invoices";
import { fetchOfficialOrderById, fetchOfficialOrderItems, type OfficialOrderItemRow, type OfficialOrderRow } from "@/lib/admin/official-orders";
import { supabase } from "@/lib/supabase";
import { generateInvoicePdfPayload } from "@/lib/invoices/client";
import type { InvoicePdfData } from "@/lib/invoices/pdf";

function ShopOrderInvoicePageContent() {
  const searchParams = useSearchParams();
  const autoPrint = searchParams.get("print") === "1";
  const id = searchParams.get("id") || "";

  const [order, setOrder] = useState<OfficialOrderRow | null>(null);
  const [items, setItems] = useState<OfficialOrderItemRow[] | null>(null);
  const [invoice, setInvoice] = useState<OfficialInvoiceRow | null>(null);
  const [resolvedUnitPrices, setResolvedUnitPrices] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const companyName = "Go Easy Enterprise (M) Sdn Bhd";
  const companyRegNo = "202101016640 (141690-W)";
  const companyAddress = "3, Jalan Mawar, Seksyen 10, Taman Perindustrian Bukit Serdang, 43300 Seri Kembangan, Selangor";

  const fallback = useMemo(
    () => ({
      id,
      currency: "MYR" as const,
      createdAt: "-",
      customerName: "未找到订单",
      customerPhone: "-",
      subtotal: 0,
      shippingFee: 0,
      discountTotal: 0,
      total: 0,
    }),
    [id],
  );

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([fetchOfficialOrderById(id), fetchOfficialOrderItems(id), fetchOfficialInvoiceByOrderId(id)]).then(([o, items, inv]) => {
      if (!active) return;
      setOrder(o);
      setItems(items);
      setInvoice(inv);
    });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!items || items.length === 0 || !order) return;
    let active = true;
    const run = async () => {
      const variantIds = [...new Set(items.filter((x) => x.item_type === "soup_pack_variant").map((x) => x.item_id))];
      const bundleIds = [...new Set(items.filter((x) => x.item_type === "bundle").map((x) => x.item_id))];
      const [variants, bundles] = await Promise.all([
        Promise.all(variantIds.map((variantId) => fetchOfficialSoupPackVariantById(variantId))),
        Promise.all(bundleIds.map((bundleId) => fetchOfficialBundleById(bundleId))),
      ]);
      if (!active) return;
      const next: Record<string, number> = {};
      variantIds.forEach((variantId, index) => {
        const variant = variants[index];
        if (!variant) return;
        const amount = Number(variant.prices?.[order.currency] ?? 0);
        if (amount > 0) next[variantId] = amount;
      });
      bundleIds.forEach((bundleId, index) => {
        const bundle = bundles[index];
        if (!bundle) return;
        const amount = Number(order.currency === "SGD" ? bundle.sgd_price : bundle.myr_price);
        if (amount > 0) next[bundleId] = amount;
      });
      setResolvedUnitPrices(next);
    };
    void run();
    return () => {
      active = false;
    };
  }, [items, order]);

  const source = order
    ? {
        id: order.id,
        customerName: order.official_profiles?.full_name ?? "-",
        customerPhone: order.official_profiles?.phone ?? "-",
        currency: order.currency,
        createdAt: new Date(order.created_at).toLocaleString(),
        subtotal: order.subtotal,
        shippingFee: order.shipping_fee,
        discountTotal: order.discount_total,
        total: order.total,
      }
    : fallback;

  const formatMoney = useMemo(() => {
    return (amount: number) => `${source.currency === "SGD" ? "S$" : "RM"} ${Number(amount).toFixed(2)}`;
  }, [source.currency]);

  useEffect(() => {
    if (!autoPrint) return;
    const timer = window.setTimeout(() => {
      const root = document.getElementById("invoice-print-root");
      if (!root) return;
      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      const printDocument = iframe.contentDocument;
      const printWindow = iframe.contentWindow;
      if (!printDocument || !printWindow) return;
      const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
        .map((node) => node.outerHTML)
        .join("");
      printDocument.open();
      printDocument.write(`<!doctype html><html><head><meta charset="utf-8">${styles}<style>@page{size:auto;margin:10mm;}html,body{margin:0;padding:0;background:#fff;}#print-doc{max-width:1000px;margin:0 auto;}</style></head><body><div id="print-doc">${root.innerHTML}</div></body></html>`);
      printDocument.close();
      window.setTimeout(() => {
        printWindow.focus();
        printWindow.print();
        iframe.remove();
        const url = new URL(window.location.href);
        url.searchParams.delete("print");
        window.history.replaceState({}, "", url.toString());
      }, 350);
    }, 200);
    return () => window.clearTimeout(timer);
  }, [autoPrint]);

  const invoiceNoText = invoice?.invoice_no ? invoice.invoice_no : `INV-${source.id}`;

  const handleGenerateAndSave = async () => {
    if (!supabase) return;
    if (!source.id || !order || !items) return;
    setBusy(true);
    setMessage("");
    try {
      const prepared = await supabase.functions.invoke("invoice-generate", {
        body: { officialOrderId: source.id, action: "prepare", channel: order.channel },
      });
      if (prepared.error) throw new Error(prepared.error.message);
      const preparedNo = (prepared.data as { data?: { invoiceNo?: string } })?.data?.invoiceNo ?? "";
      if (!preparedNo) throw new Error((prepared.data as { message?: string })?.message ?? "Prepare invoice failed");

      const pdfData: InvoicePdfData = {
        invoiceNo: preparedNo,
        orderId: source.id,
        createdAtText: source.createdAt,
        currency: source.currency,
        customerName: source.customerName,
        customerPhone: source.customerPhone,
        companyName,
        companyRegNo,
        companyAddress,
        lines: items.map((line) => {
          const title = line.title ?? line.item_id;
          const unitPrice = Number(line.unit_price) > 0 ? Number(line.unit_price) : Number(resolvedUnitPrices[line.item_id] ?? 0);
          return { title, quantity: line.quantity, unitPrice };
        }),
        subtotal: source.subtotal,
        shippingFee: source.shippingFee,
        discountTotal: source.discountTotal,
        total: source.total,
      };

      const payload = await generateInvoicePdfPayload(pdfData);
      const saved = await supabase.functions.invoke("invoice-generate", {
        body: {
          officialOrderId: source.id,
          channel: order.channel,
          pdfBase64: payload.pdfBase64,
          sha256: payload.sha256,
          sizeBytes: payload.sizeBytes,
        },
      });
      if (saved.error) throw new Error(saved.error.message);
      const savedNo = (saved.data as { data?: { invoiceNo?: string } })?.data?.invoiceNo ?? "";
      if (!savedNo) throw new Error((saved.data as { message?: string })?.message ?? "Save invoice failed");
      const refreshed = await fetchOfficialInvoiceByOrderId(source.id);
      setInvoice(refreshed);
      setMessage("PDF已保存");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "生成失败");
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadSaved = async () => {
    if (!supabase) return;
    if (!source.id) return;
    setBusy(true);
    setMessage("");
    try {
      const res = await supabase.functions.invoke("invoice-signed-url", { body: { officialOrderId: source.id } });
      if (res.error) throw new Error(res.error.message);
      const url = (res.data as { data?: { signedUrl?: string } })?.data?.signedUrl ?? "";
      if (!url) throw new Error((res.data as { message?: string })?.message ?? "Get signed URL failed");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "下载失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div id="invoice-print-root" className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/admin/shop/orders/detail?id=${source.id}`} className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10">
          返回订单
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleGenerateAndSave}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            保存PDF
          </button>
          <button
            type="button"
            onClick={handleDownloadSaved}
            disabled={busy}
            className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            下载已保存PDF
          </button>
          <Link href={`/admin/shop/orders/invoice?id=${source.id}&print=1`} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
            下载PDF
          </Link>
          <Link href={`/admin/shop/orders/receipt?id=${source.id}`} className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10">
            打开Receipt
          </Link>
        </div>
      </div>
      {message && <div className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 print:hidden">{message}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950 print:rounded-none print:border-0 print:shadow-none">
        <div className="bg-gradient-to-r from-primary to-primary/80 px-6 py-6 text-white print:bg-white print:text-black">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black">INVOICE</h1>
              <p className="mt-2 text-sm opacity-90">
                Order {source.id} · {source.createdAt}
              </p>
            </div>
            <div className="max-w-md text-right text-sm">
              <p className="font-bold">{companyName}</p>
              <p className="opacity-90">{companyRegNo}</p>
              <p className="mt-1 opacity-90">{companyAddress}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 px-6 py-6 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 print:bg-white">
            <p className="text-xs font-bold text-slate-500">Bill To</p>
            <p className="mt-2 text-lg font-black">{source.customerName}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{source.customerPhone}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50 print:bg-white">
            <p className="text-xs font-bold text-slate-500">Invoice Info</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Invoice No: {invoiceNoText}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Currency: {source.currency}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Payment: Online</p>
          </div>
        </div>

        <div className="px-6 pb-6">
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 print:border-slate-300">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 print:bg-slate-100">
                <tr>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(items ?? []).map((line) => {
                  const title = line.title ?? line.item_id;
                  const unitPrice = Number(line.unit_price) > 0 ? Number(line.unit_price) : Number(resolvedUnitPrices[line.item_id] ?? 0);
                  const lineTotal = unitPrice * line.quantity;
                  return (
                    <tr key={line.id} className="border-t border-slate-100 dark:border-slate-800 print:border-slate-200">
                      <td className="px-4 py-3 font-semibold">{title}</td>
                      <td className="px-4 py-3">{line.quantity}</td>
                      <td className="px-4 py-3">{formatMoney(unitPrice)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(lineTotal)}</td>
                    </tr>
                  );
                })}
                {items === null && (
                  <tr className="border-t border-slate-100 dark:border-slate-800 print:border-slate-200">
                    <td className="px-4 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={4}>
                      加载中...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="ml-auto w-full max-w-xs rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50 print:bg-white">
              <div className="flex items-center justify-between gap-8 text-sm">
                <p className="text-slate-500 dark:text-slate-300">Subtotal</p>
                <p className="font-bold">{formatMoney(source.subtotal)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-8 text-sm">
                <p className="text-slate-500 dark:text-slate-300">Shipping</p>
                <p className="font-bold">{formatMoney(source.shippingFee)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between gap-8 text-sm">
                <p className="text-slate-500 dark:text-slate-300">Voucher</p>
                <p className="font-bold text-primary">- {formatMoney(source.discountTotal)}</p>
              </div>
              <div className="mt-4 flex items-center justify-between gap-8 border-t border-slate-200 pt-3 text-base dark:border-slate-800">
                <p className="font-black">Total</p>
                <p className="text-lg font-black">{formatMoney(source.total)}</p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-1 text-xs text-slate-500 dark:text-slate-300 print:text-slate-600">
            <p>This invoice is generated automatically by Go Easy Enterprise (M) Sdn Bhd.</p>
            <p>No signature required.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShopOrderInvoicePage() {
  return (
    <Suspense fallback={null}>
      <ShopOrderInvoicePageContent />
    </Suspense>
  );
}
