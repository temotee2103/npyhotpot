"use client";

import { useId, useState, type ChangeEvent } from "react";

type AdminFilePickerProps = {
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  capture?: boolean | "user" | "environment";
  buttonLabel?: string;
  emptyLabel?: string;
  className?: string;
  onSelect: (files: File[]) => void | Promise<void>;
};

export function AdminFilePicker({
  accept = "image/*",
  multiple = false,
  disabled = false,
  capture,
  buttonLabel = "Choose File",
  emptyLabel = "未选择文件",
  className,
  onSelect,
}: AdminFilePickerProps) {
  const inputId = useId();
  const [fileText, setFileText] = useState(emptyLabel);

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setFileText(multiple ? `已选择 ${files.length} 个文件` : files[0].name);
    await onSelect(files);
    event.target.value = "";
  };

  return (
    <div className={["flex items-center gap-3", className].filter(Boolean).join(" ")}>
      <label
        htmlFor={inputId}
        className={`tap-bouncy rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-bold text-primary hover:bg-primary/10 ${
          disabled ? "pointer-events-none opacity-60" : "cursor-pointer"
        }`}
      >
        {buttonLabel}
      </label>
      <input id={inputId} type="file" accept={accept} multiple={multiple} disabled={disabled} capture={capture} onChange={handleChange} className="sr-only" />
      <span className="text-sm text-[color:var(--theme-muted)]">{fileText}</span>
    </div>
  );
}
