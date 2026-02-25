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
      <header className="rounded-2xl border border-slate-200 bg-white px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{eyebrow}</p>
            <h1 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h1>
            {description ? <p className="text-xs text-slate-600">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </header>
      {children}
    </div>
  );
}
