"use client";

import { useEffect, useState } from "react";
import { UnifiedTable } from "@/components/unified-table";
import { supabase } from "@/lib/supabase";

type PointsCampaignRow = {
  id: string;
  name: string;
  status: "active" | "disabled";
  starts_at: string;
  ends_at: string | null;
  apply_self: boolean;
  apply_upline: boolean;
  self_multiplier: number;
  upline_multiplier: number;
  channels: string[];
  tiers: string[];
  overlap_strategy: "max_only";
  notes: string | null;
  created_at: string;
};

type CampaignForm = {
  name: string;
  starts_at: string;
  ends_at: string;
  apply_self: boolean;
  apply_upline: boolean;
  self_multiplier: string;
  upline_multiplier: string;
  channels: string[];
  tiers: string[];
  notes: string;
};

const CHANNEL_OPTIONS = [
  { value: "all", label: "全部渠道 (all)" },
  { value: "shop", label: "商城 (shop)" },
  { value: "delivery", label: "外卖 (delivery)" },
  { value: "dine_in", label: "门店扫码 (dine_in)" },
];

const TIER_OPTIONS = [
  { value: "none", label: "New (none)" },
  { value: "bronze", label: "Bronze" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
];

const defaultForm: CampaignForm = {
  name: "",
  starts_at: "",
  ends_at: "",
  apply_self: true,
  apply_upline: false,
  self_multiplier: "1",
  upline_multiplier: "1",
  channels: ["all"],
  tiers: ["none", "bronze", "silver", "gold"],
  notes: "",
};

export default function AdminPointsCampaignsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PointsCampaignRow[]>([]);
  const [form, setForm] = useState<CampaignForm>(defaultForm);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openMenu, setOpenMenu] = useState<null | "channels" | "tiers">(null);

  const toggleMultiValue = (field: "channels" | "tiers", value: string) => {
    setForm((prev) => {
      const current = prev[field];
      const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      return {
        ...prev,
        [field]: next.length > 0 ? next : field === "channels" ? ["all"] : ["none"],
      };
    });
  };

  const channelSummary = form.channels
    .map((value) => CHANNEL_OPTIONS.find((option) => option.value === value)?.label ?? value)
    .join(", ");
  const tierSummary = form.tiers
    .map((value) => TIER_OPTIONS.find((option) => option.value === value)?.label ?? value)
    .join(", ");

  const reload = async () => {
    if (!supabase) {
      setRows([]);
      setLoading(false);
      setMessage("Supabase 未初始化");
      return;
    }
    const res = await supabase
      .from("official_points_campaigns")
      .select("id,name,status,starts_at,ends_at,apply_self,apply_upline,self_multiplier,upline_multiplier,channels,tiers,overlap_strategy,notes,created_at")
      .order("created_at", { ascending: false });
    if (res.error) {
      setRows([]);
      setMessage(res.error.message);
      setLoading(false);
      return;
    }
    setRows((res.data ?? []) as PointsCampaignRow[]);
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload();
    }, 0);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
        <h1 className="text-3xl font-black">积分活动管理</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">支持本人积分与上级返利分开设定，活动重叠时固定取最高倍率（max_only）。</p>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <UnifiedTable title="活动列表">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3">活动</th>
                <th className="px-5 py-3">倍率</th>
                <th className="px-5 py-3">范围</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3">
                    <p className="font-bold">{row.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      {new Date(row.starts_at).toLocaleString()} - {row.ends_at ? new Date(row.ends_at).toLocaleString() : "长期"}
                    </p>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <p>Self x{Number(row.self_multiplier).toFixed(2)}</p>
                    <p>Upline x{Number(row.upline_multiplier).toFixed(2)}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-500 dark:text-slate-300">
                    <p>渠道：{(row.channels ?? []).join(", ") || "-"}</p>
                    <p>等级：{(row.tiers ?? []).join(", ") || "-"}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${row.status === "active" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"}`}>
                      {row.status === "active" ? "生效中" : "已停用"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      type="button"
                      className="rounded-md border border-primary/40 px-3 py-1 text-xs font-bold text-primary hover:bg-primary/10"
                      onClick={async () => {
                        if (!supabase) return;
                        const nextStatus = row.status === "active" ? "disabled" : "active";
                        const update = await supabase.from("official_points_campaigns").update({ status: nextStatus }).eq("id", row.id);
                        if (update.error) {
                          setMessage(update.error.message);
                          return;
                        }
                        setMessage(`活动已${nextStatus === "active" ? "启用" : "停用"}`);
                        await reload();
                      }}
                    >
                      {row.status === "active" ? "停用" : "启用"}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 ? (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={5}>
                    暂无活动
                  </td>
                </tr>
              ) : null}
              {loading ? (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={5}>
                    加载中...
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </UnifiedTable>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-xl font-black">新建积分活动</h2>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              活动名称（必填）
              <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="例如：周末双倍积分" />
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              开始时间（必填）
              <input type="datetime-local" value={form.starts_at} onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              结束时间（可选，不填代表长期）
              <input type="datetime-local" value={form.ends_at} onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
                本人积分倍率
                <input value={form.self_multiplier} onChange={(event) => setForm((prev) => ({ ...prev, self_multiplier: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="例如 1 / 2 / 3" />
              </label>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
                上级返利倍率
                <input value={form.upline_multiplier} onChange={(event) => setForm((prev) => ({ ...prev, upline_multiplier: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="例如 1 / 1.5 / 2" />
              </label>
            </div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              生效渠道（Dropdown 多选）
              <div className="relative mt-1">
                <button
                  type="button"
                  onClick={() => setOpenMenu((prev) => (prev === "channels" ? null : "channels"))}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <span>{channelSummary || "请选择生效渠道"}</span>
                  <span className="material-symbols-outlined text-base text-slate-400">expand_more</span>
                </button>
                {openMenu === "channels" ? (
                  <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    {CHANNEL_OPTIONS.map((option) => (
                      <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={form.channels.includes(option.value)}
                          onChange={() => toggleMultiValue("channels", option.value)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => setOpenMenu(null)}
                      className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary/90"
                    >
                      完成
                    </button>
                  </div>
                ) : null}
              </div>
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              适用会员等级（Dropdown 多选）
              <div className="relative mt-1">
                <button
                  type="button"
                  onClick={() => setOpenMenu((prev) => (prev === "tiers" ? null : "tiers"))}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                >
                  <span>{tierSummary || "请选择适用等级"}</span>
                  <span className="material-symbols-outlined text-base text-slate-400">expand_more</span>
                </button>
                {openMenu === "tiers" ? (
                  <div className="absolute z-20 mt-2 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                    {TIER_OPTIONS.map((option) => (
                      <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800">
                        <input
                          type="checkbox"
                          checked={form.tiers.includes(option.value)}
                          onChange={() => toggleMultiValue("tiers", option.value)}
                          className="h-4 w-4 accent-primary"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                    <button
                      type="button"
                      onClick={() => setOpenMenu(null)}
                      className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary/90"
                    >
                      完成
                    </button>
                  </div>
                ) : null}
              </div>
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              活动备注（可选）
              <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} className="mt-1 h-20 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="例如：仅用于会员日活动" />
            </label>
            <div className="flex items-center gap-3 text-sm">
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.apply_self} onChange={(event) => setForm((prev) => ({ ...prev, apply_self: event.target.checked }))} />
                <span>作用本人积分</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={form.apply_upline} onChange={(event) => setForm((prev) => ({ ...prev, apply_upline: event.target.checked }))} />
                <span>作用上级返利</span>
              </label>
            </div>
            <button
              disabled={saving}
              className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              onClick={async () => {
                if (!supabase) return;
                if (!form.name.trim() || !form.starts_at) {
                  setMessage("请填写活动名称与开始时间");
                  return;
                }
                setSaving(true);
                const insert = await supabase.from("official_points_campaigns").insert({
                  name: form.name.trim(),
                  status: "active",
                  starts_at: new Date(form.starts_at).toISOString(),
                  ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
                  apply_self: form.apply_self,
                  apply_upline: form.apply_upline,
                  self_multiplier: Number(form.self_multiplier || 1),
                  upline_multiplier: Number(form.upline_multiplier || 1),
                  channels: form.channels,
                  tiers: form.tiers,
                  overlap_strategy: "max_only",
                  notes: form.notes.trim() || null,
                });
                setSaving(false);
                if (insert.error) {
                  setMessage(insert.error.message);
                  return;
                }
                setMessage("活动已创建");
                setForm(defaultForm);
                await reload();
              }}
            >
              {saving ? "保存中..." : "保存活动"}
            </button>
            {message ? <p className="text-xs font-bold text-primary">{message}</p> : null}
          </div>
        </article>
      </section>
    </div>
  );
}
