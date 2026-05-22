"use client";

import { useMemo, useState } from "react";

export type MemberCouponDropdownOption = {
  code: string;
  title: string;
  templateCode: string;
  valueLabel: string;
  expiresAt: string | null;
  stackable: boolean;
  disabledReason: string | null;
};

export function MemberCouponDropdown({
  options,
  selectedCodes,
  onToggle,
  placeholder,
}: {
  options: MemberCouponDropdownOption[];
  selectedCodes: string[];
  onToggle: (code: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => {
    const selected = options.filter((option) => selectedCodes.includes(option.code));
    if (selected.length === 0) return "";
    return selected.map((option) => option.templateCode).join(", ");
  }, [options, selectedCodes]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] px-3 py-2 text-left text-sm text-[color:var(--foreground)] shadow-sm backdrop-blur-sm dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface-elevated)]"
      >
        <span className={summary ? "" : "text-[color:var(--theme-muted)]"}>{summary || placeholder}</span>
        <span className="material-symbols-outlined text-base text-[color:var(--theme-muted)]">expand_more</span>
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 max-h-80 w-full overflow-y-auto rounded-2xl border border-[color:var(--theme-border)] bg-[color:var(--theme-surface-elevated)] p-2 shadow-2xl backdrop-blur-xl dark:border-[color:var(--theme-border-strong)] dark:bg-[color:var(--theme-surface-elevated)]">
          {options.length === 0 ? (
            <p className="px-3 py-4 text-sm text-[color:var(--theme-muted)]">当前没有可选优惠券</p>
          ) : (
            options.map((option) => {
              const selected = selectedCodes.includes(option.code);
              const disabled = !selected && Boolean(option.disabledReason);
              return (
                <label
                  key={option.code}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl px-3 py-3 ${
                    disabled ? "opacity-50" : "hover:bg-black/4 dark:hover:bg-white/6"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onToggle(option.code)}
                    className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-[color:var(--foreground)]">{option.templateCode}</p>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{option.valueLabel}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${option.stackable ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300" : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200"}`}>
                        {option.stackable ? "可叠加" : "不可叠加"}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-[color:var(--theme-muted)]">{option.title}</p>
                    <p className="mt-1 text-[11px] text-[color:var(--theme-muted)]">
                      到期：{option.expiresAt ? new Date(option.expiresAt).toLocaleString("zh-CN", { hour12: false }) : "未设置"}
                    </p>
                    {option.disabledReason ? <p className="mt-1 text-[11px] font-bold text-amber-600 dark:text-amber-300">{option.disabledReason}</p> : null}
                  </div>
                </label>
              );
            })
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 w-full rounded-xl bg-primary px-3 py-2 text-sm font-bold text-white hover:bg-primary/90"
          >
            完成
          </button>
        </div>
      ) : null}
    </div>
  );
}
