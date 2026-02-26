"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Loader2, PlayCircle, Search, ShieldAlert, Timer } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/page-shell";
import { OpsCard, OpsMetricCard } from "@/components/ui/ops-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createScan, listProjects, listProjectScans } from "@/lib/api";
import { getScanFailureCause } from "@/lib/scan-failure";
import type { Project, Scan } from "@/types/api";

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
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("");
  const [startingProjectId, setStartingProjectId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projectPage = await listProjects();
      setProjects(projectPage.results);
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

  const runScanForProject = async (projectId: number) => {
    setStartingProjectId(projectId);
    try {
      const scan = await createScan(String(projectId));
      router.push(`/scans/${scan.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Unable to start scan.");
      }
    } finally {
      setStartingProjectId(null);
    }
  };

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

  const projectSummary = useMemo(() => {
    const summary: Record<number, { total: number; active: number; failed: number }> = {};
    for (const row of rows) {
      const item = summary[row.projectId] ?? { total: 0, active: 0, failed: 0 };
      item.total += 1;
      if (row.scan.status === "running" || row.scan.status === "queued") {
        item.active += 1;
      }
      if (row.scan.status === "failed") {
        item.failed += 1;
      }
      summary[row.projectId] = item;
    }
    return summary;
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
        chipDotClassName="bg-emerald-500"
        chipLabel="Run Queue"
        description="Start a new scan from any configured repository."
        icon={PlayCircle}
        title="Run scan"
        contentClassName="space-y-2"
      >
        {projects.length === 0 ? <p className="text-xs text-[var(--ink-muted)]">No repositories configured yet.</p> : null}
        {projects.map((project) => {
          const summary = projectSummary[project.id] ?? { total: 0, active: 0, failed: 0 };
          return (
            <div className="rounded-xl bg-slate-100/90 p-3" key={project.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">{project.name}</p>
                  <p className="mt-1 break-all text-[11px] text-[var(--ink-muted)]">{project.repo_url || "No repository source configured"}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Badge variant={summary.active > 0 ? "warning" : "default"}>{summary.active} active</Badge>
                  <Badge variant={summary.failed > 0 ? "danger" : "default"}>{summary.failed} failed</Badge>
                  <Badge variant="default">{summary.total} total</Badge>
                  <Button
                    className="h-8 px-2.5"
                    disabled={startingProjectId === project.id}
                    onClick={() => void runScanForProject(project.id)}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    {startingProjectId === project.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                        Run scan
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </OpsCard>

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
            {filteredRows.map((row) => {
              const failureCause = getScanFailureCause(row.scan);
              return (
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
                      {failureCause ? <p className="mt-2 text-[11px] text-red-700">Failure cause: {failureCause}</p> : null}
                    </div>
                    <Badge variant={statusVariant(row.scan.status)}>{row.scan.status}</Badge>
                  </div>
                </Link>
              );
            })}
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
