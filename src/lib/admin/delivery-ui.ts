export function timelineTone(step: string | null | undefined) {
  const value = (step ?? "").toLowerCase();
  if (["completed", "delivered"].includes(value)) {
    return {
      dot: "bg-emerald-500 ring-emerald-500/20",
      badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
      line: "from-emerald-500/40 to-emerald-500/0",
    };
  }
  if (["cancelled", "canceled", "failed", "expired"].includes(value)) {
    return {
      dot: "bg-rose-500 ring-rose-500/20",
      badge: "bg-rose-500/10 text-rose-600 dark:text-rose-300",
      line: "from-rose-500/40 to-rose-500/0",
    };
  }
  if (["requested", "assigning_driver", "in_transit", "picked_up", "on_going"].includes(value)) {
    return {
      dot: "bg-primary ring-primary/20",
      badge: "bg-primary/10 text-primary",
      line: "from-primary/40 to-primary/0",
    };
  }
  return {
    dot: "bg-slate-400 ring-slate-400/20",
    badge: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    line: "from-slate-400/30 to-slate-400/0",
  };
}
