"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { fetchPayexPaymentStatus } from "@/lib/payments/payex";
import { supabase } from "@/lib/supabase";

type DeliveryStatusPayload = {
  data?: {
    delivery?: { status?: string; lalamove_order_id?: string | null } | null;
    payment?: { status?: string } | null;
  };
};

function resolvePaymentStatusErrorMessage(payment: { message: string; reason?: "invalid_order_id" | "order_not_found" }) {
  if (payment.message === "Not authenticated") {
    return "请先登录后查看支付状态";
  }
  if (payment.message === "Forbidden") {
    return "你没有权限查看此订单的支付状态";
  }
  if (payment.reason === "invalid_order_id" || payment.reason === "order_not_found") {
    return "未找到对应支付记录，请检查订单链接或稍后再试";
  }
  return `支付状态查询失败：${payment.message}`;
}

function readPayexSearchParams() {
  if (typeof window === "undefined") {
    return { orderId: "", channel: "shop" as const };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    orderId: params.get("payex_order") ?? "",
    channel: (params.get("payex_channel") ?? "shop") as "shop" | "delivery",
  };
}

export default function PaymentResultPage() {
  const [query, setQuery] = useState<{ orderId: string; channel: "shop" | "delivery" } | null>(null);
  const orderId = query?.orderId ?? "";
  const channel = query?.channel ?? "shop";
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("正在读取支付结果...");
  const [paymentStatus, setPaymentStatus] = useState<string>("");
  const [deliveryOrderId, setDeliveryOrderId] = useState<string | null>(null);
  const [deliveryStatus, setDeliveryStatus] = useState<string | null>(null);

  useEffect(() => {
    setQuery(readPayexSearchParams());
  }, []);

  useEffect(() => {
    if (!query) {
      return;
    }
    if (!orderId) {
      setLoading(false);
      setMessage("缺少订单号，无法确认支付状态");
      return;
    }

    setLoading(true);
    setMessage("正在确认支付结果...");
    setPaymentStatus("");
    setDeliveryOrderId(null);
    setDeliveryStatus(null);

    let active = true;
    const run = async () => {
      const payment = await fetchPayexPaymentStatus(orderId);
      if (!active) return;
      if (!payment.ok) {
        setMessage(resolvePaymentStatusErrorMessage(payment));
        setLoading(false);
        return;
      }
      const p = payment.data as { data?: { payment?: { status?: string } } };
      const payStatus = p?.data?.payment?.status ?? "";
      setPaymentStatus(payStatus);

      if (channel === "shop") {
        if (payStatus === "succeeded") setMessage("付款成功，订单已确认");
        else if (payStatus === "failed") setMessage("付款失败，请重新下单");
        else setMessage("付款处理中，请稍后刷新页面");
        setLoading(false);
        return;
      }

      if (!supabase) {
        setMessage("系统未初始化，无法查询配送状态");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("checkout-delivery", {
        body: { action: "status", officialOrderId: orderId },
      });
      if (!active) return;
      if (error) {
        if (error.message === "Not authenticated") {
          setMessage("支付已完成，请先登录后查看配送状态");
        } else if (error.message === "Forbidden") {
          setMessage("支付已完成，你没有权限查看此订单的配送状态");
        } else {
          setMessage(`支付已完成，配送状态查询失败：${error.message}`);
        }
        setLoading(false);
        return;
      }
      const deliveryPayload = data as DeliveryStatusPayload;
      const delivery = deliveryPayload?.data?.delivery;
      setDeliveryOrderId(delivery?.lalamove_order_id ?? null);
      setDeliveryStatus(delivery?.status ?? null);

      if (payStatus === "succeeded" && delivery?.lalamove_order_id) {
        setMessage("付款成功，配送单已创建");
      } else if (payStatus === "succeeded") {
        setMessage("付款成功，正在创建配送单，请稍后刷新");
      } else if (payStatus === "failed") {
        setMessage("付款失败，请重新下单");
      } else {
        setMessage("付款处理中，请稍后刷新页面");
      }
      setLoading(false);
    };

    void run();
    return () => {
      active = false;
    };
  }, [channel, orderId, query]);

  const paymentOutcome = useMemo(() => {
    if (paymentStatus === "succeeded") {
      return {
        title: "付款成功",
        tone: "text-emerald-600",
      };
    }
    if (loading || !paymentStatus || paymentStatus === "pending") {
      return {
        title: "付款处理中",
        tone: "text-slate-900 dark:text-slate-100",
      };
    }
    return {
      title: "付款未完成",
      tone: "text-rose-600",
    };
  }, [loading, paymentStatus]);

  const deliveryDispatchOutcome = useMemo(() => {
    if (channel !== "delivery") return null;
    if (paymentStatus !== "succeeded") {
      return {
        label: "配送创建状态",
        value: "等待付款确认",
        tone: "text-slate-500 dark:text-slate-300",
      };
    }
    if (deliveryOrderId) {
      return {
        label: "配送创建状态",
        value: "配送单已创建",
        tone: "text-emerald-600",
      };
    }
    return {
      label: "配送创建状态",
      value: "付款成功，配送单创建中",
      tone: "text-amber-600 dark:text-amber-300",
    };
  }, [channel, deliveryOrderId, paymentStatus]);

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-background-light text-slate-900 dark:bg-background-dark dark:text-slate-100">
      <Navbar />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
        <section className="rounded-3xl border border-primary/20 bg-white p-8 shadow-sm dark:border-primary/30 dark:bg-slate-900/70">
          <p className="text-xs font-black tracking-[0.16em] text-primary">PAYMENT RESULT</p>
          <h1 className={`mt-2 text-3xl font-black ${paymentOutcome.tone}`}>
            {paymentOutcome.title}
          </h1>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{message}</p>

          <div className="mt-6 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-300">订单号</span>
              <span className="font-bold">{orderId || "-"}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-300">渠道</span>
              <span className="font-bold">{channel}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500 dark:text-slate-300">支付状态</span>
              <span className="font-bold">{paymentStatus || "-"}</span>
            </div>
            {channel === "delivery" ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-300">配送状态</span>
                  <span className="font-bold">{deliveryStatus || "-"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-300">配送单号</span>
                  <span className="font-bold">{deliveryOrderId || "-"}</span>
                </div>
                {deliveryDispatchOutcome ? (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-300">{deliveryDispatchOutcome.label}</span>
                    <span className={`font-bold ${deliveryDispatchOutcome.tone}`}>{deliveryDispatchOutcome.value}</span>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90">
              返回首页
            </Link>
            <Link
              href={channel === "delivery" ? "/delivery" : "/shop?cart=1"}
              className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10"
            >
              返回{channel === "delivery" ? "外卖页" : "商城购物车"}
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
