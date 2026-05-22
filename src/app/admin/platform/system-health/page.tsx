"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ActionLogRow = {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  channel: string | null;
  status: string;
  detail: Record<string, unknown> | null;
  created_at: string;
  actor_role: string | null;
};

type RuntimeSettingRow = {
  key: string;
  value: string | null;
};

type RuntimeSettingsForm = {
  payex_reconcile_pending_hours: string;
  dispatch_retry_hours: string;
  stale_coupon_reservation_minutes: string;
  admin_action_logs_retention_days: string;
  ops_alert_enabled: boolean;
  ops_alert_webhook_url: string;
  ops_alert_channel_name: string;
  ops_alert_min_severity: "info" | "warning" | "critical";
};

type HealthPaymentRow = {
  id: string;
  order_id: string;
  status: string;
  created_at: string;
};

type HealthPaymentContextRow = {
  id: string;
  order_id: string;
  channel: string;
  status: string;
  created_at: string;
};

type HealthCouponRow = {
  id: string;
  status: string;
  reserved_order_id: string | null;
  reserved_at: string | null;
};

type HealthDeliveryRow = {
  id: string;
  order_id: string;
  status: string;
  lalamove_order_id: string | null;
  updated_at: string | null;
  created_at: string;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", { hour12: false });
}

function formatRelativeMinutes(value: string | null | undefined) {
  if (!value) return "-";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff)) return "-";
  const minutes = Math.max(0, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  return `${days} 天前`;
}

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
      : value === "partial_success"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
        : value.includes("failed") || value === "error"
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
          : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-200";

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${tone}`}>{value}</span>;
}

function HealthMetricCard({
  label,
  value,
  hint,
  tone = "slate",
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "slate" | "primary" | "amber" | "rose" | "emerald";
}) {
  const className =
    tone === "primary"
      ? "border-primary/20 bg-primary/5 text-primary"
      : tone === "amber"
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300"
        : tone === "rose"
          ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300"
          : tone === "emerald"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300"
            : "border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100";

  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-3 text-3xl font-black">{value}</p>
      <p className="mt-2 text-xs opacity-80">{hint}</p>
    </article>
  );
}

export default function AdminSystemHealthPage() {
  const [loading, setLoading] = useState(true);
  const [actionLogs, setActionLogs] = useState<ActionLogRow[]>([]);
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettingRow[]>([]);
  const [payments, setPayments] = useState<HealthPaymentRow[]>([]);
  const [paymentContexts, setPaymentContexts] = useState<HealthPaymentContextRow[]>([]);
  const [coupons, setCoupons] = useState<HealthCouponRow[]>([]);
  const [deliveries, setDeliveries] = useState<HealthDeliveryRow[]>([]);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [healing, setHealing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [settingsForm, setSettingsForm] = useState<RuntimeSettingsForm>({
    payex_reconcile_pending_hours: "48",
    dispatch_retry_hours: "24",
    stale_coupon_reservation_minutes: "30",
    admin_action_logs_retention_days: "180",
    ops_alert_enabled: false,
    ops_alert_webhook_url: "",
    ops_alert_channel_name: "Operations",
    ops_alert_min_severity: "warning",
  });

  const loadData = useCallback(async () => {
    const db = supabase;
    if (!db) {
      setLoading(false);
      return;
    }
    const [logsRes, settingsRes, paymentsRes, contextsRes, couponsRes, deliveriesRes] = await Promise.all([
      db
        .from("official_admin_action_logs")
        .select("id,action,target_type,target_id,channel,status,detail,created_at,actor_role")
        .order("created_at", { ascending: false })
        .limit(120),
      db
        .from("official_runtime_settings")
        .select("key,value")
        .in("key", [
          "payex_reconcile_pending_hours",
          "dispatch_retry_hours",
          "stale_coupon_reservation_minutes",
          "admin_action_logs_retention_days",
          "ops_alert_enabled",
          "ops_alert_webhook_url",
          "ops_alert_channel_name",
          "ops_alert_min_severity",
        ])
        .order("key", { ascending: true }),
      db
        .from("official_payments")
        .select("id,order_id,status,created_at")
        .in("status", ["pending", "created"])
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(120),
      db
        .from("official_payment_contexts")
        .select("id,order_id,channel,status,created_at")
        .eq("channel", "delivery")
        .order("created_at", { ascending: false })
        .limit(120),
      db
        .from("official_user_coupons")
        .select("id,status,reserved_order_id,reserved_at")
        .not("reserved_order_id", "is", null)
        .not("reserved_at", "is", null)
        .order("reserved_at", { ascending: false })
        .limit(120),
      db
        .from("official_deliveries")
        .select("id,order_id,status,lalamove_order_id,updated_at,created_at")
        .order("created_at", { ascending: false })
        .limit(120),
    ]);

    const nextRuntimeSettings = (settingsRes.data ?? []) as RuntimeSettingRow[];
    const nextSettingsMap = new Map<string, string>();
    for (const row of nextRuntimeSettings) {
      nextSettingsMap.set(row.key, String(row.value ?? ""));
    }

    setActionLogs((logsRes.data ?? []) as ActionLogRow[]);
    setRuntimeSettings(nextRuntimeSettings);
    setPayments((paymentsRes.data ?? []) as HealthPaymentRow[]);
    setPaymentContexts((contextsRes.data ?? []) as HealthPaymentContextRow[]);
    setCoupons((couponsRes.data ?? []) as HealthCouponRow[]);
    setDeliveries((deliveriesRes.data ?? []) as HealthDeliveryRow[]);
    setSettingsForm({
      payex_reconcile_pending_hours: nextSettingsMap.get("payex_reconcile_pending_hours") || "48",
      dispatch_retry_hours: nextSettingsMap.get("dispatch_retry_hours") || "24",
      stale_coupon_reservation_minutes: nextSettingsMap.get("stale_coupon_reservation_minutes") || "30",
      admin_action_logs_retention_days: nextSettingsMap.get("admin_action_logs_retention_days") || "180",
      ops_alert_enabled: ["true", "1", "yes", "on"].includes((nextSettingsMap.get("ops_alert_enabled") || "false").toLowerCase()),
      ops_alert_webhook_url: nextSettingsMap.get("ops_alert_webhook_url") || "",
      ops_alert_channel_name: nextSettingsMap.get("ops_alert_channel_name") || "Operations",
      ops_alert_min_severity: ((nextSettingsMap.get("ops_alert_min_severity") || "warning").toLowerCase() as "info" | "warning" | "critical"),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, [loadData]);

  const settingsMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of runtimeSettings) {
      map.set(row.key, String(row.value ?? ""));
    }
    return map;
  }, [runtimeSettings]);

  const staleCouponMinutes = Number(settingsMap.get("stale_coupon_reservation_minutes") ?? "30") || 30;
  const pendingPaymentHours = Number(settingsMap.get("payex_reconcile_pending_hours") ?? "48") || 48;
  const dispatchRetryHours = Number(settingsMap.get("dispatch_retry_hours") ?? "24") || 24;
  const retentionDays = Number(settingsMap.get("admin_action_logs_retention_days") ?? "180") || 180;
  const [healthSnapshotTime] = useState(() => Date.now());

  const staleReservationThreshold = healthSnapshotTime - staleCouponMinutes * 60000;
  const staleReservedCoupons = useMemo(
    () => coupons.filter((row) => row.reserved_at && new Date(row.reserved_at).getTime() <= staleReservationThreshold),
    [coupons, staleReservationThreshold],
  );
  const stuckDispatchContexts = useMemo(
    () => paymentContexts.filter((row) => row.status === "pending" || row.status.startsWith("dispatch_failed:")),
    [paymentContexts],
  );
  const activeDeliveries = useMemo(
    () => deliveries.filter((row) => !["completed", "cancelled", "failed"].includes(row.status)),
    [deliveries],
  );
  const selfHealLogs = useMemo(() => actionLogs.filter((row) => row.action === "ops_self_heal"), [actionLogs]);
  const deliverySyncLogs = useMemo(() => actionLogs.filter((row) => row.action === "delivery_status_sync"), [actionLogs]);
  const latestSelfHeal = selfHealLogs[0] ?? null;
  const latestSync = deliverySyncLogs[0] ?? null;
  const partialOrFailedLogs = useMemo(
    () => actionLogs.filter((row) => row.status === "partial_success" || row.status === "error" || row.status === "failed"),
    [actionLogs],
  );

  const invokeSelfHeal = useCallback(async () => {
    if (!supabase || healing) return;
    setHealing(true);
    const { data, error } = await supabase.functions.invoke("ops-self-heal", {
      body: { source: "admin-system-health" },
    });
    setHealing(false);
    if (error) {
      setActionMessage(`自愈执行失败：${error.message}`);
      window.setTimeout(() => setActionMessage(null), 3600);
      return;
    }
    const result = (data ?? {}) as { reconciledPayments?: number; repairedDispatches?: number; releasedCoupons?: number };
    setActionMessage(
      `自愈已执行：对账 ${Number(result.reconciledPayments ?? 0)}，补派 ${Number(result.repairedDispatches ?? 0)}，释放优惠券 ${Number(result.releasedCoupons ?? 0)}`,
    );
    window.setTimeout(() => setActionMessage(null), 3600);
    await loadData();
  }, [healing, loadData]);

  const invokeDeliverySync = useCallback(async () => {
    if (!supabase || syncing) return;
    setSyncing(true);
    const { data, error } = await supabase.functions.invoke("delivery-admin-sync", {
      body: {},
    });
    setSyncing(false);
    if (error) {
      setActionMessage(`配送同步失败：${error.message}`);
      window.setTimeout(() => setActionMessage(null), 3600);
      return;
    }
    const result = (data ?? {}) as { changed?: number };
    setActionMessage(`配送同步已执行：更新 ${Number(result.changed ?? 0)} 笔`);
    window.setTimeout(() => setActionMessage(null), 3200);
    await loadData();
  }, [loadData, syncing]);

  const saveRuntimeSettings = useCallback(async () => {
    if (!supabase || savingSettings) return;
    setSavingSettings(true);
    const payload = [
      { key: "payex_reconcile_pending_hours", value: settingsForm.payex_reconcile_pending_hours.trim() || "48" },
      { key: "dispatch_retry_hours", value: settingsForm.dispatch_retry_hours.trim() || "24" },
      { key: "stale_coupon_reservation_minutes", value: settingsForm.stale_coupon_reservation_minutes.trim() || "30" },
      { key: "admin_action_logs_retention_days", value: settingsForm.admin_action_logs_retention_days.trim() || "180" },
      { key: "ops_alert_enabled", value: settingsForm.ops_alert_enabled ? "true" : "false" },
      { key: "ops_alert_webhook_url", value: settingsForm.ops_alert_webhook_url.trim() },
      { key: "ops_alert_channel_name", value: settingsForm.ops_alert_channel_name.trim() || "Operations" },
      { key: "ops_alert_min_severity", value: settingsForm.ops_alert_min_severity },
    ];

    const { error } = await supabase.from("official_runtime_settings").upsert(payload, { onConflict: "key" });
    setSavingSettings(false);
    if (error) {
      setActionMessage(`保存治理参数失败：${error.message}`);
      window.setTimeout(() => setActionMessage(null), 3600);
      return;
    }
    setActionMessage("治理参数已保存");
    window.setTimeout(() => setActionMessage(null), 2600);
    await loadData();
  }, [loadData, savingSettings, settingsForm]);

  const sendTestAlert = useCallback(async () => {
    if (!supabase || testingAlert) return;
    setTestingAlert(true);
    const { data, error } = await supabase.functions.invoke("ops-alert-test", {
      body: { source: "system-health-ui" },
    });
    setTestingAlert(false);
    if (error) {
      setActionMessage(`测试告警失败：${error.message}`);
      window.setTimeout(() => setActionMessage(null), 3600);
      return;
    }
    const result = (data ?? {}) as { skipped?: boolean; message?: string };
    setActionMessage(result.skipped ? `测试告警已跳过：${result.message ?? "skipped"}` : "测试告警已发送");
    window.setTimeout(() => setActionMessage(null), 3600);
    await loadData();
  }, [loadData, testingAlert]);

  const riskFeed = useMemo(
    () =>
      [
        ...payments.slice(0, 12).map((row) => ({
          kind: "payment",
          title: "待对账支付",
          detail: `订单 ${row.order_id.slice(0, 8)} | ${row.status}`,
          at: row.created_at,
        })),
        ...stuckDispatchContexts.slice(0, 12).map((row) => ({
          kind: "dispatch",
          title: "待修复派单上下文",
          detail: `订单 ${row.order_id.slice(0, 8)} | ${row.status}`,
          at: row.created_at,
        })),
        ...staleReservedCoupons.slice(0, 12).map((row) => ({
          kind: "coupon",
          title: "超时预占优惠券",
          detail: `券 ${row.id.slice(0, 8)} | 订单 ${String(row.reserved_order_id ?? "-").slice(0, 8)}`,
          at: row.reserved_at ?? "",
        })),
      ]
        .sort((a, b) => +new Date(b.at) - +new Date(a.at))
        .slice(0, 12),
    [payments, staleReservedCoupons, stuckDispatchContexts],
  );

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-3xl border border-primary/15 bg-white shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(239,124,48,0.22),transparent_28%),radial-gradient(circle_at_top_right,rgba(15,118,110,0.14),transparent_24%)] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">System Health</p>
              <h1 className="mt-2 text-3xl font-black">系统健康</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-500 dark:text-slate-300">
                独立承接支付自愈、配送同步、优惠券释放、治理参数与审计轨迹，不再与业务报表混用。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={invokeSelfHeal}
                disabled={healing}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
              >
                {healing ? "自愈执行中..." : "手动执行自愈"}
              </button>
              <button
                type="button"
                onClick={invokeDeliverySync}
                disabled={syncing}
                className="rounded-xl border border-primary/30 px-4 py-2 text-sm font-bold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {syncing ? "同步中..." : "手动同步配送"}
              </button>
              <button
                type="button"
                onClick={() => void loadData()}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
              >
                刷新
              </button>
            </div>
          </div>
          {actionMessage ? (
            <div className="mt-4 rounded-2xl border border-primary/20 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-sm backdrop-blur dark:border-primary/20 dark:bg-slate-950/50 dark:text-slate-200">
              {actionMessage}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <HealthMetricCard label="待对账支付" value={String(payments.length)} hint={`按最近数据窗口扫描，建议 ${pendingPaymentHours} 小时内重点关注`} tone="amber" />
        <HealthMetricCard label="待修复派单" value={String(stuckDispatchContexts.length)} hint={`包含 pending 与 dispatch_failed，恢复窗口 ${dispatchRetryHours} 小时`} tone="rose" />
        <HealthMetricCard label="超时优惠券预占" value={String(staleReservedCoupons.length)} hint={`按 ${staleCouponMinutes} 分钟超时口径计算`} tone="primary" />
        <HealthMetricCard label="活跃配送单" value={String(activeDeliveries.length)} hint="未完成、未取消、未失败的配送单量" tone="emerald" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">实时风险摘要</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">集中展示当前最值得运营关注的待修复事项。</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${loading ? "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"}`}>
              {loading ? "Loading" : "Live"}
            </span>
          </div>
          <div className="mt-5 space-y-3">
            {riskFeed.map((item, index) => (
              <div key={`${item.kind}-${item.at}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${item.kind === "payment" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : item.kind === "dispatch" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : "bg-primary/10 text-primary"}`}>
                      {item.kind}
                    </span>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-300">{formatRelativeMinutes(item.at)}</p>
                </div>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{item.detail}</p>
              </div>
            ))}
            {riskFeed.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                当前没有明显待修复项，系统状态稳定。
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
          <h2 className="text-xl font-black">治理参数</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">展示当前自愈窗口与保留策略，帮助运营理解自动化边界。</p>
          <div className="mt-5 space-y-3">
            {[
              { label: "支付对账窗口", value: `${pendingPaymentHours} 小时`, hint: "超过窗口外的支付不会纳入默认自愈扫描" },
              { label: "派单重试窗口", value: `${dispatchRetryHours} 小时`, hint: "卡住配送上下文的自动补派范围" },
              { label: "优惠券预占超时", value: `${staleCouponMinutes} 分钟`, hint: "超过该时间将释放仍被预占的券" },
              { label: "审计日志保留", value: `${retentionDays} 天`, hint: "后台操作审计的自动清理周期" },
            ].map((item) => (
              <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                  <p className="text-sm font-black text-primary">{item.value}</p>
                </div>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-300">{item.hint}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-black">治理控制台</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">直接在后台调整自愈窗口和主动告警 routing。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={sendTestAlert}
                  disabled={testingAlert}
                  className="rounded-lg border border-primary/30 px-3 py-2 text-xs font-bold text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {testingAlert ? "测试发送中..." : "发送测试告警"}
                </button>
                <button
                  type="button"
                  onClick={saveRuntimeSettings}
                  disabled={savingSettings}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900"
                >
                  {savingSettings ? "保存中..." : "保存参数"}
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                支付对账窗口（小时）
                <input
                  value={settingsForm.payex_reconcile_pending_hours}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, payex_reconcile_pending_hours: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                />
              </label>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                派单重试窗口（小时）
                <input
                  value={settingsForm.dispatch_retry_hours}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, dispatch_retry_hours: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                />
              </label>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                优惠券预占超时（分钟）
                <input
                  value={settingsForm.stale_coupon_reservation_minutes}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, stale_coupon_reservation_minutes: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                />
              </label>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                审计日志保留（天）
                <input
                  value={settingsForm.admin_action_logs_retention_days}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, admin_action_logs_retention_days: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                />
              </label>
            </div>
            <div className="mt-3 grid gap-3">
              <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm dark:border-slate-700 dark:bg-slate-900/50">
                <input
                  type="checkbox"
                  checked={settingsForm.ops_alert_enabled}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, ops_alert_enabled: event.target.checked }))}
                  className="h-4 w-4 accent-primary"
                />
                <span className="font-semibold text-slate-900 dark:text-slate-100">启用主动告警推送</span>
              </label>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                告警 Webhook URL
                <input
                  type="password"
                  value={settingsForm.ops_alert_webhook_url}
                  onChange={(event) => setSettingsForm((prev) => ({ ...prev, ops_alert_webhook_url: event.target.value }))}
                  placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                  告警频道名称
                  <input
                    value={settingsForm.ops_alert_channel_name}
                    onChange={(event) => setSettingsForm((prev) => ({ ...prev, ops_alert_channel_name: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                  />
                </label>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-300">
                  最低告警级别
                  <select
                    value={settingsForm.ops_alert_min_severity}
                    onChange={(event) => setSettingsForm((prev) => ({ ...prev, ops_alert_min_severity: event.target.value as "info" | "warning" | "critical" }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/60"
                  >
                    <option value="info">info</option>
                    <option value="warning">warning</option>
                    <option value="critical">critical</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">最近自愈与同步</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">自愈和配送同步执行结果会写入统一审计日志。</p>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {[latestSelfHeal, latestSync].filter(Boolean).map((log) => {
              const detail = (log?.detail ?? {}) as Record<string, unknown>;
              return (
                <div key={log!.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-900 dark:text-slate-100">{log!.action === "ops_self_heal" ? "自动自愈" : "配送同步"}</p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">{formatDateTime(log!.created_at)} · {formatRelativeMinutes(log!.created_at)}</p>
                    </div>
                    <StatusBadge value={log!.status} />
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/50">
                      <p className="text-[11px] text-slate-500 dark:text-slate-300">对账</p>
                      <p className="mt-1 font-black">{Number(detail.reconciled_payments ?? 0)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/50">
                      <p className="text-[11px] text-slate-500 dark:text-slate-300">补派</p>
                      <p className="mt-1 font-black">{Number(detail.repaired_dispatches ?? detail.changed ?? 0)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/50">
                      <p className="text-[11px] text-slate-500 dark:text-slate-300">释放优惠券</p>
                      <p className="mt-1 font-black">{Number(detail.released_coupons ?? 0)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {!latestSelfHeal && !latestSync ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                还没有抓到最近的自愈或同步日志。
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
          <h2 className="text-xl font-black">异常审计流</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">聚焦 `partial_success / failed / error`，便于复盘自动化边界。</p>
          <div className="mt-5 space-y-3">
            {partialOrFailedLogs.slice(0, 8).map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{log.action}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      {log.target_type}{log.target_id ? ` · ${log.target_id}` : ""} · {formatDateTime(log.created_at)}
                    </p>
                  </div>
                  <StatusBadge value={log.status} />
                </div>
              </div>
            ))}
            {partialOrFailedLogs.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                最近日志里没有部分成功或失败记录。
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
          <h2 className="text-xl font-black">近期活跃配送单</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">帮助观察当前仍在流转中的配送队列。</p>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-4 py-3">订单</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">Provider ID</th>
                  <th className="px-4 py-3">更新时间</th>
                </tr>
              </thead>
              <tbody>
                {activeDeliveries.slice(0, 10).map((row) => (
                  <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="px-4 py-3 font-semibold">{row.order_id.slice(0, 8)}</td>
                    <td className="px-4 py-3"><StatusBadge value={row.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-300">{row.lalamove_order_id ?? "-"}</td>
                    <td className="px-4 py-3 text-xs">{formatDateTime(row.updated_at ?? row.created_at)}</td>
                  </tr>
                ))}
                {activeDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-5 text-center text-slate-500 dark:text-slate-300">
                      当前没有活跃配送单。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900/40">
          <h2 className="text-xl font-black">最近操作日志</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">展示最新后台操作，作为运维与治理的统一审计入口。</p>
          <div className="mt-5 space-y-3">
            {actionLogs.slice(0, 10).map((log) => (
              <div key={log.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{log.action}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      {log.actor_role ?? "system"} · {log.channel ?? "all"} · {formatDateTime(log.created_at)}
                    </p>
                  </div>
                  <StatusBadge value={log.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
