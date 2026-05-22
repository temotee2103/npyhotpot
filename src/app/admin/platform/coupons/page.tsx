"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { UnifiedTable } from "@/components/unified-table";

type CouponTemplateRow = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  discount_type: "percent" | "fixed_amount";
  percent_off: number | null;
  amount_off_myr: number | null;
  amount_off_sgd: number | null;
  points_cost: number;
  is_points_redeemable: boolean;
  applies_channels: string[];
  stackable: boolean;
  status: "enabled" | "disabled";
  starts_at: string | null;
  ends_at: string | null;
};

type CouponRuleRow = {
  id: string;
  title: string;
  status: "enabled" | "disabled";
  trigger_type: "birthday_month" | "new_registration" | "calendar_window" | "manual_batch";
  template_id: string;
  applies_tiers: string[];
  valid_days: number;
  trigger_config?: {
    window_start?: string;
    window_end?: string;
    grace_days?: number;
  } | null;
};

type UserCouponRow = {
  id: string;
  user_id: string;
  template_id: string;
  status: "issued" | "redeemed" | "expired" | "revoked";
  issued_reason: "manual_issue" | "points_redeem" | "birthday_auto" | "registration_auto" | "rule_auto";
  issued_at: string;
  expires_at: string | null;
  official_profiles?: { full_name?: string | null; phone?: string | null } | null;
  official_coupon_templates?: { title?: string | null; code?: string | null } | null;
};

type ProfileLite = { id: string; full_name: string | null; phone: string | null };

type DropdownOption = {
  value: string;
  label: string;
};

const DISCOUNT_TYPE_OPTIONS: DropdownOption[] = [
  { value: "percent", label: "百分比" },
  { value: "fixed_amount", label: "固定金额" },
];

const RULE_TRIGGER_OPTIONS: DropdownOption[] = [
  { value: "birthday_month", label: "生日月份" },
  { value: "new_registration", label: "新注册" },
  { value: "calendar_window", label: "节日 / 日期窗口" },
  { value: "manual_batch", label: "手动批次" },
];

const ISSUE_REASON_OPTIONS: DropdownOption[] = [
  { value: "manual_issue", label: "手动派发" },
  { value: "points_redeem", label: "积分兑换" },
  { value: "birthday_auto", label: "生日自动" },
  { value: "registration_auto", label: "新注册自动" },
  { value: "rule_auto", label: "规则自动" },
];

const TIER_OPTIONS: DropdownOption[] = [
  { value: "none", label: "New (none)" },
  { value: "bronze", label: "Bronze" },
  { value: "silver", label: "Silver" },
  { value: "gold", label: "Gold" },
];

const CHANNEL_OPTIONS: DropdownOption[] = [
  { value: "shop", label: "Shop 商城" },
  { value: "delivery", label: "Delivery 外卖" },
  { value: "dine_in", label: "Dine-In 堂食" },
];

function triggerTypeLabel(triggerType: CouponRuleRow["trigger_type"]) {
  return RULE_TRIGGER_OPTIONS.find((option) => option.value === triggerType)?.label ?? triggerType;
}

function formatRuleTriggerConfig(rule: CouponRuleRow) {
  if (rule.trigger_type === "calendar_window") {
    const start = rule.trigger_config?.window_start?.trim() || "-";
    const end = rule.trigger_config?.window_end?.trim() || "-";
    return `${start} ~ ${end}`;
  }
  if (rule.trigger_type === "new_registration") {
    return `注册后 ${rule.trigger_config?.grace_days ?? 30} 天内`;
  }
  if (rule.trigger_type === "birthday_month") {
    return "按用户生日月份自动派发";
  }
  return "仅手动批次执行";
}

function SingleSelectDropdown({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label ?? "";

  return (
    <div className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        <span className={selectedLabel ? "" : "text-slate-400"}>{selectedLabel || placeholder}</span>
        <span className="material-symbols-outlined text-base text-slate-400">expand_more</span>
      </button>
      {open ? (
        <div className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 ${
                value === option.value ? "font-bold text-primary" : "text-slate-700 dark:text-slate-100"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MultiSelectDropdown({
  values,
  onChange,
  options,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: DropdownOption[];
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const summary = values.map((value) => options.find((option) => option.value === value)?.label ?? value).join(", ");

  return (
    <div className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
      >
        <span className={summary ? "" : "text-slate-400"}>{summary || placeholder}</span>
        <span className="material-symbols-outlined text-base text-slate-400">expand_more</span>
      </button>
      {open ? (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {options.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800">
              <input
                type="checkbox"
                checked={values.includes(option.value)}
                onChange={() => {
                  const next = values.includes(option.value) ? values.filter((item) => item !== option.value) : [...values, option.value];
                  onChange(next.length > 0 ? next : ["none"]);
                }}
                className="h-4 w-4 accent-primary"
              />
              <span>{option.label}</span>
            </label>
          ))}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary/90"
          >
            完成
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminPlatformCouponsPage() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [autoIssueSchemaReady, setAutoIssueSchemaReady] = useState(true);
  const [templates, setTemplates] = useState<CouponTemplateRow[]>([]);
  const [rules, setRules] = useState<CouponRuleRow[]>([]);
  const [userCoupons, setUserCoupons] = useState<UserCouponRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [savingRule, setSavingRule] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [runningAutoIssue, setRunningAutoIssue] = useState(false);

  const [templateForm, setTemplateForm] = useState({
    code: "",
    title: "",
    discount_type: "percent" as "percent" | "fixed_amount",
    percent_off: "10",
    amount_off_myr: "10",
    amount_off_sgd: "3",
    points_cost: "0",
    is_points_redeemable: false,
    applies_channels: ["shop", "delivery", "dine_in"] as string[],
    stackable: false,
    starts_at: "",
    ends_at: "",
    is_permanent: false,
  });

  const [ruleForm, setRuleForm] = useState({
    title: "",
    trigger_type: "birthday_month" as "birthday_month" | "new_registration" | "calendar_window" | "manual_batch",
    template_id: "",
    applies_tiers: ["none", "bronze", "silver", "gold"] as string[],
    valid_days: "30",
    window_start: "",
    window_end: "",
    grace_days: "30",
  });

  const [issueForm, setIssueForm] = useState({
    user_id: "",
    template_id: "",
    expires_at: "",
    reason: "manual_issue" as "manual_issue" | "points_redeem" | "birthday_auto" | "registration_auto" | "rule_auto",
  });

  const templateById = useMemo(() => {
    const map = new Map<string, CouponTemplateRow>();
    for (const row of templates) map.set(row.id, row);
    return map;
  }, [templates]);

  const templateOptions = useMemo<DropdownOption[]>(
    () => templates.map((template) => ({ value: template.id, label: `${template.code} - ${template.title}` })),
    [templates],
  );

  const enabledTemplateOptions = useMemo<DropdownOption[]>(
    () =>
      templates
        .filter((template) => template.status === "enabled")
        .map((template) => ({ value: template.id, label: `${template.code} - ${template.title}` })),
    [templates],
  );

  const profileOptions = useMemo<DropdownOption[]>(
    () =>
      profiles.map((profile) => ({
        value: profile.id,
        label: `${(profile.full_name ?? "未命名用户").trim()} (${(profile.phone ?? "").trim() || profile.id})`,
      })),
    [profiles],
  );

  const reload = async () => {
    if (!supabase) {
      setMessage("Supabase 未初始化");
      setLoading(false);
      return;
    }
    const [templatesRes, userCouponsRes, profilesRes] = await Promise.all([
      supabase
        .from("official_coupon_templates")
        .select("id,code,title,description,discount_type,percent_off,amount_off_myr,amount_off_sgd,points_cost,is_points_redeemable,applies_channels,stackable,status,starts_at,ends_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("official_user_coupons")
        .select("id,user_id,template_id,status,issued_reason,issued_at,expires_at,official_profiles!official_user_coupons_user_id_fkey(full_name,phone),official_coupon_templates(title,code)")
        .order("issued_at", { ascending: false })
        .limit(1000),
      supabase.from("official_profiles").select("id,full_name,phone").eq("status", "active").order("created_at", { ascending: false }).limit(1000),
    ]);

    if (templatesRes.error || userCouponsRes.error || profilesRes.error) {
      setMessage(templatesRes.error?.message ?? userCouponsRes.error?.message ?? profilesRes.error?.message ?? "加载失败");
      setLoading(false);
      return;
    }

    const rulesWithConfigRes = await supabase
      .from("official_coupon_issuance_rules")
      .select("id,title,status,trigger_type,template_id,applies_tiers,valid_days,trigger_config")
      .order("created_at", { ascending: false })
      .limit(500);

    let rulesData: CouponRuleRow[] = [];
    if (rulesWithConfigRes.error?.message?.includes("trigger_config")) {
      const legacyRulesRes = await supabase
        .from("official_coupon_issuance_rules")
        .select("id,title,status,trigger_type,template_id,applies_tiers,valid_days")
        .order("created_at", { ascending: false })
        .limit(500);
      if (legacyRulesRes.error) {
        setMessage(legacyRulesRes.error.message);
        setLoading(false);
        return;
      }
      rulesData = ((legacyRulesRes.data ?? []) as CouponRuleRow[]).map((row) => ({ ...row, trigger_config: null }));
      setAutoIssueSchemaReady(false);
      setMessage("数据库尚未应用最新优惠券自动派发迁移，已切换为兼容模式；节日窗口与立即执行功能需先更新数据库。");
    } else if (rulesWithConfigRes.error) {
      setMessage(rulesWithConfigRes.error.message);
      setLoading(false);
      return;
    } else {
      rulesData = (rulesWithConfigRes.data ?? []) as CouponRuleRow[];
      setAutoIssueSchemaReady(true);
    }

    setTemplates((templatesRes.data ?? []) as CouponTemplateRow[]);
    setRules(rulesData);
    setUserCoupons((userCouponsRes.data ?? []) as UserCouponRow[]);
    setProfiles((profilesRes.data ?? []) as ProfileLite[]);
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
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-black">会员优惠券管理</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-300">支持积分兑换券模板、自动派发规则、手动派发给指定会员。</p>
          </div>
          <button
            type="button"
            disabled={runningAutoIssue || !autoIssueSchemaReady}
            onClick={async () => {
              if (!supabase) return;
              setRunningAutoIssue(true);
              const res = await supabase.rpc("official_run_coupon_auto_issuance", {
                p_now: new Date().toISOString(),
                p_rule_id: null,
              });
              setRunningAutoIssue(false);
              if (res.error) {
                setMessage(res.error.message);
                return;
              }
              const payload = res.data as { issued_count?: number; processed_users?: number; ok?: boolean } | null;
              if (!payload?.ok) {
                setMessage("自动派发执行失败");
                return;
              }
              setMessage(`自动派发完成：处理 ${payload.processed_users ?? 0} 位用户，派发 ${payload.issued_count ?? 0} 张优惠券`);
              await reload();
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {runningAutoIssue ? "执行中..." : "立即执行自动派发"}
          </button>
        </div>
        {!autoIssueSchemaReady ? (
          <p className="mt-3 text-xs text-amber-600 dark:text-amber-300">当前数据库仍是旧版 schema，页面可继续查看与手动派发，但节日窗口和自动执行需先应用最新 migration。</p>
        ) : null}
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-lg font-black">新建优惠券模板</h2>
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              模板编码（必填）
              <input value={templateForm.code} onChange={(event) => setTemplateForm((prev) => ({ ...prev, code: event.target.value.toUpperCase().trim() }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="例如：BIRTHDAY10" />
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              模板标题（必填）
              <input value={templateForm.title} onChange={(event) => setTemplateForm((prev) => ({ ...prev, title: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="例如：生日月 10% OFF" />
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              优惠类型
              <SingleSelectDropdown
                value={templateForm.discount_type}
                onChange={(value) => setTemplateForm((prev) => ({ ...prev, discount_type: value as "percent" | "fixed_amount" }))}
                options={DISCOUNT_TYPE_OPTIONS}
                placeholder="选择优惠类型"
              />
            </label>
            {templateForm.discount_type === "percent" ? (
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
                百分比折扣（%）
                <input value={templateForm.percent_off} onChange={(event) => setTemplateForm((prev) => ({ ...prev, percent_off: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="例如：10" />
              </label>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
                  MYR 减免金额
                  <input value={templateForm.amount_off_myr} onChange={(event) => setTemplateForm((prev) => ({ ...prev, amount_off_myr: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="例如：10" />
                </label>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
                  SGD 减免金额
                  <input value={templateForm.amount_off_sgd} onChange={(event) => setTemplateForm((prev) => ({ ...prev, amount_off_sgd: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="例如：3" />
                </label>
              </div>
            )}
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              兑换积分成本（仅积分兑换券）
              <input value={templateForm.points_cost} onChange={(event) => setTemplateForm((prev) => ({ ...prev, points_cost: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="例如：300" />
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              适用渠道（Dropdown 多选）
              <MultiSelectDropdown
                values={templateForm.applies_channels}
                onChange={(values) => setTemplateForm((prev) => ({ ...prev, applies_channels: values }))}
                options={CHANNEL_OPTIONS}
                placeholder="选择适用渠道"
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
                生效开始时间
                <input type="datetime-local" value={templateForm.starts_at} onChange={(event) => setTemplateForm((prev) => ({ ...prev, starts_at: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
              </label>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
                生效结束时间（可选）
                <input
                  type="datetime-local"
                  value={templateForm.ends_at}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, ends_at: event.target.value }))}
                  disabled={templateForm.is_permanent}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={templateForm.is_permanent}
                  onChange={(event) =>
                    setTemplateForm((prev) => ({
                      ...prev,
                      is_permanent: event.target.checked,
                      ends_at: event.target.checked ? "" : prev.ends_at,
                    }))
                  }
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <span>永久生效</span>
              </label>
              <label className="inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={templateForm.is_points_redeemable}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, is_points_redeemable: event.target.checked }))}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <span>允许积分兑换</span>
              </label>
              <label className="inline-flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={templateForm.stackable}
                  onChange={(event) => setTemplateForm((prev) => ({ ...prev, stackable: event.target.checked }))}
                  className="h-4 w-4 shrink-0 accent-primary"
                />
                <span>允许叠加使用</span>
              </label>
            </div>
            <button
              disabled={savingTemplate}
              className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              onClick={async () => {
                if (!supabase) return;
                if (!templateForm.code || !templateForm.title) {
                  setMessage("请填写模板编码与标题");
                  return;
                }
                setSavingTemplate(true);
                const payload =
                  templateForm.discount_type === "percent"
                    ? {
                        code: templateForm.code,
                        title: templateForm.title,
                        discount_type: "percent" as const,
                        percent_off: Number(templateForm.percent_off || 0),
                        points_cost: Number(templateForm.points_cost || 0),
                        is_points_redeemable: templateForm.is_points_redeemable,
                        applies_channels: templateForm.applies_channels,
                        stackable: templateForm.stackable,
                        starts_at: templateForm.starts_at ? new Date(templateForm.starts_at).toISOString() : null,
                        ends_at: templateForm.is_permanent ? null : templateForm.ends_at ? new Date(templateForm.ends_at).toISOString() : null,
                      }
                    : {
                        code: templateForm.code,
                        title: templateForm.title,
                        discount_type: "fixed_amount" as const,
                        amount_off_myr: Number(templateForm.amount_off_myr || 0),
                        amount_off_sgd: Number(templateForm.amount_off_sgd || 0),
                        points_cost: Number(templateForm.points_cost || 0),
                        is_points_redeemable: templateForm.is_points_redeemable,
                        applies_channels: templateForm.applies_channels,
                        stackable: templateForm.stackable,
                        starts_at: templateForm.starts_at ? new Date(templateForm.starts_at).toISOString() : null,
                        ends_at: templateForm.is_permanent ? null : templateForm.ends_at ? new Date(templateForm.ends_at).toISOString() : null,
                      };
                const insert = await supabase.from("official_coupon_templates").insert(payload);
                setSavingTemplate(false);
                if (insert.error) {
                  setMessage(insert.error.message);
                  return;
                }
                setTemplateForm({
                  code: "",
                  title: "",
                  discount_type: "percent",
                  percent_off: "10",
                  amount_off_myr: "10",
                  amount_off_sgd: "3",
                  points_cost: "0",
                  is_points_redeemable: false,
                  applies_channels: ["shop", "delivery", "dine_in"],
                  stackable: false,
                  starts_at: "",
                  ends_at: "",
                  is_permanent: false,
                });
                setMessage("模板已创建");
                await reload();
              }}
            >
              {savingTemplate ? "保存中..." : "保存模板"}
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-lg font-black">新建自动派发规则</h2>
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              规则标题（必填）
              <input value={ruleForm.title} onChange={(event) => setRuleForm((prev) => ({ ...prev, title: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="例如：生日月自动派发" />
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              关联模板（必选）
              <SingleSelectDropdown
                value={ruleForm.template_id}
                onChange={(value) => setRuleForm((prev) => ({ ...prev, template_id: value }))}
                options={templateOptions}
                placeholder="选择模板"
              />
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              触发类型
              <SingleSelectDropdown
                value={ruleForm.trigger_type}
                onChange={(value) =>
                  setRuleForm((prev) => ({
                    ...prev,
                    trigger_type: value as "birthday_month" | "new_registration" | "calendar_window" | "manual_batch",
                  }))
                }
                options={RULE_TRIGGER_OPTIONS}
                placeholder="选择触发类型"
              />
            </label>
            {ruleForm.trigger_type === "calendar_window" ? (
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
                  窗口开始日期
                  <input
                    type="date"
                    value={ruleForm.window_start}
                    onChange={(event) => setRuleForm((prev) => ({ ...prev, window_start: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
                  窗口结束日期
                  <input
                    type="date"
                    value={ruleForm.window_end}
                    onChange={(event) => setRuleForm((prev) => ({ ...prev, window_end: event.target.value }))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  />
                </label>
              </div>
            ) : null}
            {ruleForm.trigger_type === "new_registration" ? (
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
                新注册命中宽限天数
                <input
                  value={ruleForm.grace_days}
                  onChange={(event) => setRuleForm((prev) => ({ ...prev, grace_days: event.target.value }))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                  placeholder="例如：30"
                />
              </label>
            ) : null}
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              适用会员等级（Dropdown 多选）
              <MultiSelectDropdown
                values={ruleForm.applies_tiers}
                onChange={(values) => setRuleForm((prev) => ({ ...prev, applies_tiers: values }))}
                options={TIER_OPTIONS}
                placeholder="选择适用会员等级"
              />
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              优惠券有效天数
              <input value={ruleForm.valid_days} onChange={(event) => setRuleForm((prev) => ({ ...prev, valid_days: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" placeholder="例如：30" />
            </label>
            <button
              disabled={savingRule}
              className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              onClick={async () => {
                if (!supabase) return;
                if (!autoIssueSchemaReady) {
                  setMessage("数据库尚未应用最新优惠券自动派发迁移，暂时不能新增自动派发规则。");
                  return;
                }
                if (!ruleForm.title.trim() || !ruleForm.template_id) {
                  setMessage("请填写规则标题并选择模板");
                  return;
                }
                if (ruleForm.trigger_type === "calendar_window" && (!ruleForm.window_start || !ruleForm.window_end)) {
                  setMessage("请填写节日 / 日期窗口的开始与结束日期");
                  return;
                }
                setSavingRule(true);
                const insert = await supabase.from("official_coupon_issuance_rules").insert({
                  title: ruleForm.title.trim(),
                  trigger_type: ruleForm.trigger_type,
                  template_id: ruleForm.template_id,
                  applies_tiers: ruleForm.applies_tiers,
                  valid_days: Number(ruleForm.valid_days || 30),
                  trigger_config:
                    ruleForm.trigger_type === "calendar_window"
                      ? {
                          window_start: ruleForm.window_start || null,
                          window_end: ruleForm.window_end || null,
                        }
                      : ruleForm.trigger_type === "new_registration"
                        ? {
                            grace_days: Number(ruleForm.grace_days || 30),
                          }
                        : {},
                  status: "enabled",
                });
                setSavingRule(false);
                if (insert.error) {
                  setMessage(insert.error.message);
                  return;
                }
                setRuleForm({
                  title: "",
                  trigger_type: "birthday_month",
                  template_id: "",
                  applies_tiers: ["none", "bronze", "silver", "gold"],
                  valid_days: "30",
                  window_start: "",
                  window_end: "",
                  grace_days: "30",
                });
                setMessage("规则已创建");
                await reload();
              }}
            >
              {savingRule ? "保存中..." : "保存规则"}
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:border-primary/20 dark:bg-slate-900/70">
          <h2 className="text-lg font-black">手动派发给指定用户</h2>
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              目标用户（必选）
              <SingleSelectDropdown
                value={issueForm.user_id}
                onChange={(value) => setIssueForm((prev) => ({ ...prev, user_id: value }))}
                options={profileOptions}
                placeholder="选择用户"
              />
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              优惠券模板（必选）
              <SingleSelectDropdown
                value={issueForm.template_id}
                onChange={(value) => setIssueForm((prev) => ({ ...prev, template_id: value }))}
                options={enabledTemplateOptions}
                placeholder="选择模板"
              />
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              派发原因
              <SingleSelectDropdown
                value={issueForm.reason}
                onChange={(value) =>
                  setIssueForm((prev) => ({ ...prev, reason: value as "manual_issue" | "points_redeem" | "birthday_auto" | "registration_auto" | "rule_auto" }))
                }
                options={ISSUE_REASON_OPTIONS}
                placeholder="选择派发原因"
              />
            </label>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-300">
              过期时间（可选）
              <input type="datetime-local" value={issueForm.expires_at} onChange={(event) => setIssueForm((prev) => ({ ...prev, expires_at: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800" />
            </label>
            <button
              disabled={issuing}
              className="w-full rounded-lg bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary/90 disabled:opacity-60"
              onClick={async () => {
                if (!supabase) return;
                if (!issueForm.user_id || !issueForm.template_id) {
                  setMessage("请选择用户与模板");
                  return;
                }
                const selectedTemplate = templateById.get(issueForm.template_id);
                setIssuing(true);
                const insert = await supabase.from("official_user_coupons").insert({
                  user_id: issueForm.user_id,
                  template_id: issueForm.template_id,
                  issuance_rule_id: null,
                  issued_by: null,
                  issued_reason: issueForm.reason,
                  points_cost: Number(selectedTemplate?.points_cost ?? 0),
                  expires_at: issueForm.expires_at ? new Date(issueForm.expires_at).toISOString() : null,
                  meta: { issued_from: "admin_platform_coupons_page" },
                });
                setIssuing(false);
                if (insert.error) {
                  setMessage(insert.error.message);
                  return;
                }
                setIssueForm({ user_id: "", template_id: "", expires_at: "", reason: "manual_issue" });
                setMessage("已成功派发优惠券");
                await reload();
              }}
            >
              {issuing ? "派发中..." : "立即派发"}
            </button>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <UnifiedTable title="模板列表">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3">模板</th>
                <th className="px-5 py-3">优惠</th>
                <th className="px-5 py-3">兑换</th>
                <th className="px-5 py-3">渠道 / 叠加</th>
                <th className="px-5 py-3">状态</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3">
                    <p className="font-bold">{row.code}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">{row.title}</p>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    {row.discount_type === "percent"
                      ? `${Number(row.percent_off ?? 0).toFixed(2)}%`
                      : `MYR ${Number(row.amount_off_myr ?? 0).toFixed(2)} / SGD ${Number(row.amount_off_sgd ?? 0).toFixed(2)}`}
                  </td>
                  <td className="px-5 py-3 text-xs">{row.is_points_redeemable ? `${Number(row.points_cost ?? 0).toFixed(0)} pts` : "不可兑换"}</td>
                  <td className="px-5 py-3 text-xs">
                    <p>{(row.applies_channels ?? []).join(", ") || "-"}</p>
                    <p className="text-slate-500 dark:text-slate-300">{row.stackable ? "可叠加" : "不可叠加"}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${row.status === "enabled" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"}`}>
                      {row.status === "enabled" ? "启用" : "停用"}
                    </span>
                  </td>
                </tr>
              ))}
              {!loading && templates.length === 0 ? (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={5}>
                    暂无模板
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </UnifiedTable>

        <UnifiedTable title="最近派发记录">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3">用户</th>
                <th className="px-5 py-3">券</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">时间</th>
              </tr>
            </thead>
            <tbody>
              {userCoupons.slice(0, 50).map((row) => (
                <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-3">
                    <p className="font-bold">{row.official_profiles?.full_name?.trim() || "未命名用户"}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">{row.official_profiles?.phone?.trim() || row.user_id}</p>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <p>{row.official_coupon_templates?.code?.trim() || "-"}</p>
                    <p className="text-slate-500 dark:text-slate-300">{row.official_coupon_templates?.title?.trim() || row.template_id}</p>
                  </td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-bold text-primary">{row.status}</span>
                  </td>
                  <td className="px-5 py-3 text-xs">{new Date(row.issued_at).toLocaleString()}</td>
                </tr>
              ))}
              {!loading && userCoupons.length === 0 ? (
                <tr className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={4}>
                    暂无派发记录
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </UnifiedTable>
      </section>

      <UnifiedTable title="规则列表">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/60">
            <tr>
              <th className="px-5 py-3">规则</th>
              <th className="px-5 py-3">触发</th>
              <th className="px-5 py-3">触发详情</th>
              <th className="px-5 py-3">模板</th>
              <th className="px-5 py-3">等级</th>
              <th className="px-5 py-3">有效天数</th>
              <th className="px-5 py-3">状态</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((row) => (
              <tr key={row.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-5 py-3">
                  <p className="font-bold">{row.title}</p>
                </td>
                <td className="px-5 py-3 text-xs">{triggerTypeLabel(row.trigger_type)}</td>
                <td className="px-5 py-3 text-xs">
                  {formatRuleTriggerConfig(row)}
                </td>
                <td className="px-5 py-3 text-xs">
                  <p>{templateById.get(row.template_id)?.code || row.template_id}</p>
                  <p className="text-slate-500 dark:text-slate-300">{templateById.get(row.template_id)?.title || "-"}</p>
                </td>
                <td className="px-5 py-3 text-xs">{(row.applies_tiers ?? []).join(", ")}</td>
                <td className="px-5 py-3 text-xs">{row.valid_days}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${row.status === "enabled" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"}`}>
                    {row.status === "enabled" ? "启用" : "停用"}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && rules.length === 0 ? (
              <tr className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-5 py-6 text-sm text-slate-500 dark:text-slate-300" colSpan={7}>
                  暂无规则
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </UnifiedTable>

      {message ? (
        <section className="rounded-2xl border border-primary/10 bg-primary/5 px-4 py-3 text-sm font-bold text-primary">{message}</section>
      ) : null}
    </div>
  );
}
