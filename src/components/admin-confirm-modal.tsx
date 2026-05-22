"use client";

import { UnifiedModal } from "@/components/unified-modal";

type AdminConfirmModalProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function AdminConfirmModal({
  open,
  title,
  description,
  confirmLabel = "确认删除",
  cancelLabel = "取消",
  loading = false,
  onConfirm,
  onCancel,
}: AdminConfirmModalProps) {
  return (
    <UnifiedModal
      open={open}
      size="sm"
      title={title}
      description={description}
      badge="Delete Confirm"
      onClose={onCancel}
      actions={
        <>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="rounded-lg border border-[color:var(--theme-border-strong)] px-4 py-2 text-sm font-bold text-[color:var(--foreground)] hover:bg-black/4 disabled:opacity-60 dark:hover:bg-white/6"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {loading ? "处理中..." : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-xs font-bold tracking-[0.14em] text-red-600 dark:text-red-400">DELETE CONFIRM</p>
    </UnifiedModal>
  );
}
