"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AdminFilePicker } from "@/components/admin-file-picker";
import { supabase } from "@/lib/supabase";

type BarcodeDetectorClass = {
  new (options?: { formats?: string[] }): {
    detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
  };
};

function extractRewardsCode(raw: string) {
  const text = raw.trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    const code = url.searchParams.get("code") ?? "";
    if (code) return code.trim().toUpperCase();
  } catch {}
  return text.toUpperCase();
}

function MerchantRewardsScanPageContent() {
  const searchParams = useSearchParams();
  const initialRewardsCode = extractRewardsCode(searchParams.get("code") ?? "");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [rewardsCode, setRewardsCode] = useState(initialRewardsCode);
  const [spendAmount, setSpendAmount] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
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
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  const startScan = async () => {
    if (scanning) return;
    const Detector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorClass }).BarcodeDetector;
    if (!Detector) {
      setMessage("当前浏览器不支持扫码，请手动输入 Rewards Code");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
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
          const code = extractRewardsCode(raw);
          if (!code) return;
          setRewardsCode(code);
          setMessage("扫码成功，已填入 Rewards Code");
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
    };
  }, []);

  useEffect(() => {
    return () => {
      stopScan();
    };
  }, []);

  const submit = async () => {
    if (!supabase || submitting) return;
    if (!rewardsCode.trim() || !spendAmount.trim() || !receiptUrl.trim()) {
      setMessage("请填写 Rewards Code、消费金额并上传单据");
      return;
    }
    const spend = Number(spendAmount);
    if (!Number.isFinite(spend) || spend <= 0) {
      setMessage("消费金额格式不正确");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    const fingerprint = `${rewardsCode.trim().toUpperCase()}|${spend.toFixed(2)}|${new Date().toISOString().slice(0, 10)}|${receiptUrl}`;
    const { data, error } = await supabase.functions.invoke("rewards-accrual-submit", {
      body: {
        rewardsCode: rewardsCode.trim().toUpperCase(),
        spendAmount: spend,
        receiptUrl,
        receiptFingerprint: fingerprint,
      },
    });
    setSubmitting(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage((data as { message?: string } | null)?.message ?? "提报成功，等待管理员审批");
    setRewardsCode("");
    setSpendAmount("");
    setReceiptUrl("");
  };

  return (
    <div className="ui-root mx-auto max-w-5xl space-y-5 px-4 py-6">
      <section className="ui-table-root rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-5 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">
        <div className="ui-table-toolbar flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Merchant Rewards</p>
            <h1 className="mt-1 text-3xl font-black text-[color:var(--foreground)]">扫码积分提报</h1>
            <p className="mt-2 text-sm text-[color:var(--theme-muted)]">扫码或输入会员 Rewards Code，上传单据后提交审批。</p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/merchant/coupons/redeem" className="rounded-lg border border-primary/40 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10">
              去优惠券核销
            </Link>
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-primary">Scan Flow</span>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="ui-table-root rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-6 text-sm shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">加载中...</section>
      ) : !authorized ? (
        <section className="ui-table-root rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700 shadow-sm dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
          当前账号不是有效 Merchant 账号或未登录。请先登录并绑定商户账号。
          <div className="mt-3">
            <Link href="/login" className="rounded-lg border border-primary/40 px-3 py-1.5 font-bold text-primary hover:bg-primary/10">
              去登录
            </Link>
          </div>
        </section>
      ) : (
        <section className="ui-table-root rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-5 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">
          <div className="ui-form-root grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-xl border border-[color:var(--theme-border)] bg-black/2 p-4 dark:border-[color:var(--theme-border-strong)] dark:bg-white/4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-bold text-[color:var(--foreground)]">扫码读取 Rewards Code</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={!scanSupported || scanning}
                    onClick={() => void startScan()}
                    className="rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {scanning ? "扫描中..." : "开始扫码"}
                  </button>
                  <button
                    type="button"
                    disabled={!scanning}
                    onClick={stopScan}
                    className="rounded-md border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-3 py-1 text-xs font-bold text-[color:var(--foreground)] hover:bg-black/4 disabled:opacity-50 dark:hover:bg-white/6"
                  >
                    停止
                  </button>
                </div>
              </div>
              <div className="mt-3 overflow-hidden rounded-lg border border-[color:var(--theme-border)] bg-black/85 dark:border-[color:var(--theme-border-strong)]">
                <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />
              </div>
              {!scanSupported ? <p className="mt-2 text-xs text-amber-600">浏览器不支持 BarcodeDetector，建议使用 Chrome/Edge。</p> : null}
            </div>
            <div className="space-y-3 rounded-xl border border-[color:var(--theme-border)] bg-black/2 p-4 dark:border-[color:var(--theme-border-strong)] dark:bg-white/4">
              <div>
                <p className="text-xs font-bold text-[color:var(--foreground)]">Rewards Code</p>
                <input
                  value={rewardsCode}
                  onChange={(event) => setRewardsCode(event.target.value)}
                  placeholder="会员 Rewards Code"
                  className="mt-1 w-full rounded-lg border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted)] outline-none focus:border-primary"
                />
              </div>
              <div>
                <p className="text-xs font-bold text-[color:var(--foreground)]">消费金额（MYR）</p>
                <input
                  value={spendAmount}
                  onChange={(event) => setSpendAmount(event.target.value)}
                  placeholder="例如 128.00"
                  inputMode="decimal"
                  className="mt-1 w-full rounded-lg border border-[color:var(--theme-border-strong)] bg-[color:var(--theme-surface-elevated)] px-3 py-2 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--theme-muted)] outline-none focus:border-primary"
                />
              </div>
              <div className="rounded-lg border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] p-3 dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface-elevated)]">
                <p className="text-xs font-bold text-[color:var(--foreground)]">上传单据凭证</p>
                <AdminFilePicker
                  className="mt-2"
                  accept="image/*"
                  capture="environment"
                  disabled={uploading}
                  buttonLabel={uploading ? "上传中..." : "上传单据照片"}
                  onSelect={async (files) => {
                    const file = files[0];
                    if (!file || !supabase) return;
                    setUploading(true);
                    const ext = file.name.split(".").pop() || "jpg";
                    const path = `rewards/receipts/${Date.now()}.${ext}`;
                    const { error } = await supabase.storage.from("media").upload(path, file, { upsert: true, contentType: file.type });
                    setUploading(false);
                    if (error) {
                      setMessage(`单据上传失败：${error.message}`);
                      return;
                    }
                    const { data } = supabase.storage.from("media").getPublicUrl(path);
                    setReceiptUrl(data.publicUrl);
                  }}
                />
                {receiptUrl ? (
                  <a className="mt-2 inline-block text-xs font-bold text-primary underline" href={receiptUrl} target="_blank" rel="noreferrer">
                    已上传，点击查看单据
                  </a>
                ) : (
                  <p className="mt-2 text-xs text-slate-300">尚未上传单据</p>
                )}
              </div>
              {message ? <p className={`text-xs font-bold ${message.includes("成功") ? "text-emerald-600" : "text-rose-600"}`}>{message}</p> : null}
              <div className="ui-actions-root flex justify-end">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void submit()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
                >
                  {submitting ? "提交中..." : "提交审批"}
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export default function MerchantRewardsScanPage() {
  return (
    <Suspense fallback={null}>
      <MerchantRewardsScanPageContent />
    </Suspense>
  );
}
