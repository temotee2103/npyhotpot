"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

type BouncyActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  success?: boolean;
  icon?: ReactNode;
  successIcon?: ReactNode;
  label?: ReactNode;
  successLabel?: ReactNode;
  contentClassName?: string;
};

export function BouncyActionButton({
  success = false,
  icon,
  successIcon,
  label,
  successLabel,
  className,
  contentClassName,
  type = "button",
  children,
  ...rest
}: BouncyActionButtonProps) {
  const nextClassName = ["tap-bouncy", "cursor-pointer", "disabled:cursor-not-allowed", className].filter(Boolean).join(" ");
  const body = children ?? (
    <span className={["inline-flex items-center gap-1", success ? "success-pop" : "", contentClassName].filter(Boolean).join(" ")}>
      {success ? (successIcon ?? icon) : icon}
      {success ? (successLabel ?? label) : label}
    </span>
  );

  return (
    <button type={type} className={nextClassName} {...rest}>
      {body}
    </button>
  );
}
