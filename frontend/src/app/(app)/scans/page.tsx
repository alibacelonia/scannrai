"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Search, ShieldAlert, Timer } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { OpsCard, OpsMetricCard } from "@/components/ui/ops-card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, listProjects, listProjectScans } from "@/lib/api";
import type { Scan } from "@/types/api";

type ScanRow = {
  scan: Scan;
  projectId: number;
  projectName: string;
};

function formatUtcTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

function statusVariant(status: Scan["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "running") return "warning" as const;
  return "default" as const;
}

export default function ScansPage() {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projectPage = await listProjects();
      const scanRows: ScanRow[] = [];
      const scansByProject = await Promise.all(
        projectPage.results.map(async (project) => {
          const scansPage = await listProjectScans(String(project.id));
          return { project, scans: scansPage.results };
        }),
      );
      for (const entry of scansByProject) {
        for (const scan of entry.scans) {
          scanRows.push({ scan, projectId: entry.project.id, projectName: entry.project.name });
        }
      }
      scanRows.sort((a, b) => new Date(b.scan.created_at).getTime() - new Date(a.scan.created_at).getTime());
      setRows(scanRows);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load scans.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    const query = projectFilter.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((row) => row.projectName.toLowerCase().includes(query) || String(row.projectId).includes(query));
  }, [projectFilter, rows]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      active: rows.filter((row) => row.scan.status === "running" || row.scan.status === "queued").length,
      failed: rows.filter((row) => row.scan.status === "failed").length,
    };
  }, [rows]);

  if (loading) {
    return <ScansSkeleton />;
  }

  return (
    <PageShell eyebrow="Scans" title="Scan Timeline" description="Track status and jump into scan findings.">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={Timer} label="Total scans" value={stats.total} />
        <MetricCard icon={Filter} label="Active queue" value={stats.active} />
        <MetricCard icon={ShieldAlert} label="Failed runs" value={stats.failed} />
      </section>

      <OpsCard
        chipDotClassName="bg-sky-500"
        chipLabel="Scan Browser"
        description="Filter by repository name or project id."
        icon={Filter}
        title="All scans"
        contentClassName="space-y-3"
      >
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Repository filter</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-subtle)]" />
              <Input
                className="pl-9"
                onChange={(event) => setProjectFilter(event.target.value)}
                placeholder="Project name or id"
                value={projectFilter}
              />
            </div>
          </div>
          {filteredRows.length === 0 ? <p className="text-xs text-[var(--ink-muted)]">No scans found.</p> : null}
          <div className="space-y-2">
            {filteredRows.map((row) => (
              <Link
                className="block rounded-xl bg-slate-100/90 p-3 transition"
                href={`/scans/${row.scan.id}`}
                key={row.scan.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">Scan #{row.scan.id}</p>
                    <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                      {row.projectName} (#{row.projectId})
                    </p>
                    <p className="mt-1 text-[11px] text-[var(--ink-subtle)]">{formatUtcTimestamp(row.scan.created_at)}</p>
                  </div>
                  <Badge variant={statusVariant(row.scan.status)}>{row.scan.status}</Badge>
                </div>
              </Link>
            ))}
          </div>
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p> : null}
      </OpsCard>
    </PageShell>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return <OpsMetricCard icon={Icon} label={label} value={value} />;
}

function ScansSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-300 bg-white p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-56 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-300 bg-white p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton className="h-14 w-full" key={`scan-row-${idx}`} />
        ))}
      </div>
    </div>
  );
}
