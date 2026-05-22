"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type BarcodeDetectorClass = {
  new (options?: { formats?: string[] }): {
    detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
  };
};

function extractCouponCode(raw: string) {
  const text = raw.trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return (url.searchParams.get("coupon") ?? url.searchParams.get("code") ?? text).trim().toUpperCase();
  } catch {
    return text.toUpperCase();
  }
}

function MerchantCouponRedeemPageContent() {
  const searchParams = useSearchParams();
  const initialCouponCode = extractCouponCode(searchParams.get("coupon") ?? searchParams.get("code") ?? "");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [couponCode, setCouponCode] = useState(initialCouponCode);
  const [spendAmount, setSpendAmount] = useState("");
  const [operatorNote, setOperatorNote] = useState("");
  const [posConfirmed, setPosConfirmed] = useState(false);
  const [currency, setCurrency] = useState<"MYR" | "SGD">("MYR");
  const [message, setMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ discountAmount: number; templateCode: string; templateTitle: string; couponCode: string; currency: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanSupported] = useState(() => Boolean((globalThis as unknown as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector));

  const stopScan = () => {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) track.stop();
      mediaStreamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  };

  const startScan = async () => {
    if (scanning) return;
    const Detector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
    if (!Detector) {
      setMessage("当前浏览器不支持扫码，请手动输入 Coupon ID");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setScanning(true);
      const detector = new Detector({ formats: ["qr_code"] });
      scanTimerRef.current = window.setInterval(async () => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        try {
          const codes = await detector.detect(video);
          const raw = (codes[0]?.rawValue ?? "").trim();
          if (!raw) return;
          const code = extractCouponCode(raw);
          if (!code) return;
          setCouponCode(code);
          setMessage("扫码成功，已填入 Coupon ID");
          stopScan();
        } catch {}
      }, 450);
    } catch {
      setMessage("无法打开摄像头，请检查浏览器权限");
      stopScan();
    }
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }
      const sessionRes = await supabase.auth.getSession();
      const userId = sessionRes.data.session?.user?.id;
      if (!userId) {
        if (!active) return;
        setAuthorized(false);
        setLoading(false);
        return;
      }
      const merchant = await supabase.from("official_merchant_accounts").select("id,status").eq("profile_id", userId).eq("status", "active").maybeSingle();
      if (!active) return;
      setAuthorized(Boolean(merchant.data?.id));
      setLoading(false);
    };
    void run();
    return () => {
      active = false;
      stopScan();
    };
  }, []);

  const submit = async () => {
    if (!supabase || submitting) return;
    const spend = Number(spendAmount);
    if (!couponCode.trim() || !Number.isFinite(spend) || spend <= 0) {
      setMessage("请填写 Coupon ID 与消费金额");
      return;
    }
    if (!posConfirmed) {
      setMessage("请先确认已在 POS 手动扣减对应金额");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    setResult(null);
    const { data, error } = await supabase.functions.invoke("coupon-merchant-redeem", {
      body: {
        couponCode: couponCode.trim().toUpperCase(),
        spendAmount: spend,
        currency,
        posConfirmed,
        operatorNote: operatorNote.trim() || undefined,
      },
    });
    setSubmitting(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const payload = (data as { data?: { discountAmount?: number; templateCode?: string; templateTitle?: string; couponCode?: string; currency?: string } } | null)?.data;
    if (!payload) {
      setMessage("核销失败，请稍后重试");
      return;
    }
    setResult({
      discountAmount: Number(payload.discountAmount ?? 0),
      templateCode: payload.templateCode ?? "-",
      templateTitle: payload.templateTitle ?? "优惠券",
      couponCode: payload.couponCode ?? couponCode.trim().toUpperCase(),
      currency: payload.currency ?? currency,
    });
    setMessage("核销成功，请在 POS 手动扣减对应金额，并记录 Coupon ID");
    setCouponCode("");
    setSpendAmount("");
    setOperatorNote("");
    setPosConfirmed(false);
  };

  return (
    <div className="ui-root mx-auto max-w-5xl space-y-5 px-4 py-6">
      <section className="rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-5 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Merchant Coupons</p>
            <h1 className="mt-1 text-3xl font-black text-[color:var(--foreground)]">堂食优惠券核销</h1>
            <p className="mt-2 text-sm text-[color:var(--theme-muted)]">扫描或输入 Coupon ID，系统会核销并返回应扣减金额，Merchant 再到 POS 手动减免。</p>
          </div>
          <Link href="/merchant/rewards/scan" className="rounded-lg border border-primary/40 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/10">
            切换到积分提报
          </Link>
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-6 text-sm shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">加载中...</section>
      ) : !authorized ? (
        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          当前账号不是有效 Merchant 账号或未登录。请先登录并绑定商户账号。
          <div className="mt-3">
            <Link href="/login" className="rounded-lg border border-primary/40 px-3 py-1.5 font-bold text-primary hover:bg-primary/10">
              去登录
            </Link>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-5 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-[color:var(--foreground)]">扫码读取 Coupon ID</p>
              <div className="flex gap-2">
                <button type="button" disabled={!scanSupported || scanning} onClick={() => void startScan()} className="rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50">
                  {scanning ? "扫描中..." : "开始扫码"}
                </button>
                <button type="button" disabled={!scanning} onClick={stopScan} className="rounded-md border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-3 py-1 text-xs font-bold text-[color:var(--foreground)] hover:bg-black/4 disabled:opacity-50 dark:hover:bg-white/6">
                  停止
                </button>
              </div>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-[color:var(--theme-border)] bg-black/85 dark:border-[color:var(--theme-border-strong)]">
              <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline />
            </div>
            {!scanSupported ? <p className="mt-2 text-xs text-amber-600">浏览器不支持 BarcodeDetector，建议使用 Chrome/Edge。</p> : null}
          </div>

          <div className="rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-5 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">
            <div className="space-y-3">
              <label className="block">
                <p className="mb-1 text-xs font-bold text-[color:var(--foreground)]">Coupon ID</p>
                <input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="例如 CPN-AB12CD34EF56" className="w-full rounded-lg border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted)] outline-none focus:border-primary" />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <p className="mb-1 text-xs font-bold text-[color:var(--foreground)]">消费金额</p>
                  <input value={spendAmount} onChange={(event) => setSpendAmount(event.target.value)} placeholder="例如 128.00" inputMode="decimal" className="w-full rounded-lg border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted)] outline-none focus:border-primary" />
                </label>
                <label className="block">
                  <p className="mb-1 text-xs font-bold text-[color:var(--foreground)]">币种</p>
                  <select value={currency} onChange={(event) => setCurrency(event.target.value as "MYR" | "SGD")} className="w-full rounded-lg border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-3 py-2 text-sm text-[color:var(--foreground)] outline-none focus:border-primary">
                    <option value="MYR">MYR</option>
                    <option value="SGD">SGD</option>
                  </select>
                </label>
              </div>
              <label className="block">
                <p className="mb-1 text-xs font-bold text-[color:var(--foreground)]">操作备注（可选）</p>
                <textarea
                  value={operatorNote}
                  onChange={(event) => setOperatorNote(event.target.value)}
                  placeholder="例如：客户现场使用、POS 单号、班次备注"
                  rows={3}
                  className="w-full rounded-lg border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted)] outline-none focus:border-primary"
                />
              </label>
              <label className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-[color:var(--foreground)] dark:text-slate-100">
                <input
                  type="checkbox"
                  checked={posConfirmed}
                  onChange={(event) => setPosConfirmed(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>我已在 POS 手动扣减对应金额，并确认要正式核销这张优惠券</span>
              </label>
              <button type="button" disabled={submitting} onClick={() => void submit()} className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60">
                {submitting ? "核销中..." : "立即核销"}
              </button>
              {message ? <p className={`text-xs font-bold ${message.includes("成功") ? "text-emerald-600" : "text-rose-600"}`}>{message}</p> : null}
              {result ? (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">POS ACTION</p>
                  <p className="mt-2 font-bold text-[color:var(--foreground)]">{result.templateCode} - {result.templateTitle}</p>
                  <p className="mt-2">Coupon ID：<span className="font-black">{result.couponCode}</span></p>
                  <p className="mt-2">请在 POS 手动扣减：<span className="font-black text-primary">{result.currency} {result.discountAmount.toFixed(2)}</span></p>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function MerchantCouponRedeemPage() {
  return (
    <Suspense fallback={null}>
      <MerchantCouponRedeemPageContent />
    </Suspense>
  );
}
