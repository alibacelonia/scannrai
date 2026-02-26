import { cn } from "@/lib/utils";

type PageShellProps = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
};

export function PageShell({ eyebrow, title, description, actions, children, className }: PageShellProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <header className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] px-5 py-4 shadow-[0_14px_30px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">{eyebrow}</p>
            <h1 className="text-base font-semibold text-[var(--ink)] sm:text-lg">{title}</h1>
            {description ? <p className="text-xs text-[var(--ink-muted)]">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </header>
      {children}
    </div>
  );
}
