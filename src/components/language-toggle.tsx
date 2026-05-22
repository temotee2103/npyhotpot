"use client";

import { useLanguage } from "@/components/language-provider";

export function LanguageToggle() {
  const { toggleLanguage, t } = useLanguage();
  return (
    <button
      onClick={toggleLanguage}
      className="rounded-xl border border-primary/20 bg-[color:var(--theme-surface-elevated)] px-3 py-2 text-sm font-semibold text-[color:var(--foreground)] shadow-sm backdrop-blur-md transition hover:border-primary/40 hover:text-primary"
    >
      {t("switchLang")}
    </button>
  );
}
