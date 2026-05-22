"use client";

import { useEffect, useId } from "react";

type UnifiedModalProps = {
  open: boolean;
  title: string;
  description?: string;
  badge?: string;
  size?: "sm" | "md" | "lg" | "xl";
  onClose: () => void;
  closeOnBackdrop?: boolean;
  children: React.ReactNode;
  actions?: React.ReactNode;
  panelClassName?: string;
  contentClassName?: string;
  actionsClassName?: string;
};

const sizeClassMap: Record<NonNullable<UnifiedModalProps["size"]>, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function UnifiedModal({
  open,
  title,
  description,
  badge,
  size = "lg",
  onClose,
  closeOnBackdrop = true,
  children,
  actions,
  panelClassName,
  contentClassName,
  actionsClassName,
}: UnifiedModalProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="ui-modal-root fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-[rgba(22,15,14,0.28)] px-3 py-3 backdrop-blur-sm dark:bg-black/45 sm:items-center sm:px-4 sm:py-6"
      onClick={() => {
        if (closeOnBackdrop) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`w-full ${sizeClassMap[size]} max-h-[calc(100vh-24px)] overflow-y-auto rounded-2xl border border-primary/20 bg-[color:var(--theme-surface-elevated)] p-4 shadow-2xl backdrop-blur-xl dark:border-primary/30 dark:bg-[color:var(--theme-surface-elevated)] sm:max-h-[calc(100vh-48px)] sm:p-6 ${panelClassName ?? ""}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ui-modal-header flex items-start justify-between gap-3">
          <div>
            <h3 id={titleId} className="text-2xl font-black">
              {title}
            </h3>
            {description ? (
              <p id={descriptionId} className="mt-1 text-sm text-[color:var(--theme-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {badge ? <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-primary">{badge}</span> : null}
        </div>
        <div className={`ui-form-root mt-4 space-y-3 ${contentClassName ?? ""}`}>{children}</div>
        {actions ? <div className={`ui-actions-root sticky bottom-0 mt-4 flex justify-end gap-2 rounded-t-xl bg-[color:var(--theme-surface-elevated)]/96 pt-3 backdrop-blur-xl ${actionsClassName ?? ""}`}>{actions}</div> : null}
      </div>
    </div>
  );
}
