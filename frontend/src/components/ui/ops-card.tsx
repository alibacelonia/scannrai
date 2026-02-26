import * as React from "react";

import { cn } from "@/lib/utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

type IconComponent = React.ComponentType<{ className?: string }>;

export function OpsCard({
  chipLabel,
  chipDotClassName,
  title,
  description,
  icon: Icon,
  className,
  contentClassName,
  children,
}: {
  chipLabel: string;
  chipDotClassName?: string;
  title: string;
  description?: string;
  icon?: IconComponent;
  className?: string;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("rounded-2xl border-slate-300 bg-white", className)}>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1">
              <span className={cn("h-1.5 w-1.5 rounded-full bg-slate-500", chipDotClassName)} />
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">{chipLabel}</p>
            </div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </div>
          {Icon ? (
            <div className="rounded-full bg-slate-100 p-2.5 text-slate-700">
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

export function OpsPanel({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("rounded-xl bg-slate-100/90 px-3 py-3", className)}>{children}</div>;
}

export function OpsMetricCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: IconComponent;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl bg-slate-100/90 px-3 py-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        {Icon ? <Icon className="h-4 w-4 text-slate-500" /> : null}
      </div>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
