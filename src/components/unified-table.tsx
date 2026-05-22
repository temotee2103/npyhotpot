"use client";

type UnifiedTableProps = {
  title?: string;
  description?: string;
  toolbar?: React.ReactNode;
  children: React.ReactNode;
};

export function UnifiedTable({ title, description, toolbar, children }: UnifiedTableProps) {
  return (
    <section className="ui-table-root rounded-2xl border border-primary/10 bg-[color:var(--theme-surface-elevated)] p-5 shadow-sm backdrop-blur-sm dark:border-primary/20 dark:bg-[color:var(--theme-surface-elevated)]">
      {title || description || toolbar ? (
        <div className="ui-table-toolbar mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? <h2 className="text-xl font-black">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm text-[color:var(--theme-muted)]">{description}</p> : null}
          </div>
          {toolbar ? <div>{toolbar}</div> : null}
        </div>
      ) : null}
      <div className="ui-table-content overflow-x-auto">{children}</div>
    </section>
  );
}
