"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderGit2, Loader2, PlayCircle, ScanSearch, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createScan, listProjectScans, listProjects } from "@/lib/api";
import type { Project, Scan } from "@/types/api";

type StatusChartItem = {
  key: "completed" | "running" | "queued" | "failed";
  label: string;
  colorClass: string;
  count: number;
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "No activity yet";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function mapStatusVariant(status: Scan["status"]): "default" | "success" | "warning" | "danger" {
  if (status === "completed") return "success";
  if (status === "running") return "warning";
  if (status === "failed") return "danger";
  return "default";
}

export default function DashboardPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectScans, setProjectScans] = useState<Record<number, Scan[]>>({});
  const [loading, setLoading] = useState(true);
  const [startingProjectId, setStartingProjectId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const projectPage = await listProjects();
      setProjects(projectPage.results);

      const scansEntries = await Promise.all(
        projectPage.results.map(async (project) => {
          const scansPage = await listProjectScans(String(project.id));
          return [project.id, scansPage.results] as const;
        }),
      );
      setProjectScans(Object.fromEntries(scansEntries));
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Unable to load dashboard.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const allScans = useMemo(() => Object.values(projectScans).flat(), [projectScans]);

  const recentScans = useMemo(
    () => allScans.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 8),
    [allScans],
  );

  const projectRows = useMemo(
    () =>
      projects.map((project) => {
        const scans = (projectScans[project.id] ?? []).slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return {
          project,
          scanCount: scans.length,
          latestScan: scans[0] ?? null,
        };
      }),
    [projects, projectScans],
  );

  const summary = useMemo(() => {
    const queued = allScans.filter((scan) => scan.status === "queued").length;
    const runningOnly = allScans.filter((scan) => scan.status === "running").length;
    const running = allScans.filter((scan) => scan.status === "running" || scan.status === "queued").length;
    const completed = allScans.filter((scan) => scan.status === "completed").length;
    const failed = allScans.filter((scan) => scan.status === "failed").length;
    return {
      repositories: projects.length,
      scans: allScans.length,
      queued,
      runningOnly,
      running,
      completed,
      failed,
    };
  }, [allScans, projects.length]);
  const completionRate = summary.scans > 0 ? Math.round((summary.completed / summary.scans) * 100) : 0;
  const failureRate = summary.scans > 0 ? Math.round((summary.failed / summary.scans) * 100) : 0;

  const statusChartData = useMemo<StatusChartItem[]>(
    () => [
      { key: "completed", label: "Completed", colorClass: "bg-emerald-500", count: summary.completed },
      { key: "running", label: "Running", colorClass: "bg-sky-500", count: summary.runningOnly },
      { key: "queued", label: "Queued", colorClass: "bg-amber-500", count: summary.queued },
      { key: "failed", label: "Failed", colorClass: "bg-rose-500", count: summary.failed },
    ],
    [summary.completed, summary.runningOnly, summary.queued, summary.failed],
  );

  const scanTrendData = useMemo(() => {
    const dayMap = new Map<string, { label: string; total: number; failed: number; completed: number }>();
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (let offset = 6; offset >= 0; offset -= 1) {
      const day = new Date(now);
      day.setDate(now.getDate() - offset);
      const key = day.toISOString().slice(0, 10);
      dayMap.set(key, {
        label: day.toLocaleDateString("en-US", { weekday: "short" }),
        total: 0,
        failed: 0,
        completed: 0,
      });
    }

    for (const scan of allScans) {
      const created = new Date(scan.created_at);
      if (Number.isNaN(created.getTime())) {
        continue;
      }
      const key = created.toISOString().slice(0, 10);
      const item = dayMap.get(key);
      if (!item) {
        continue;
      }
      item.total += 1;
      if (scan.status === "failed") {
        item.failed += 1;
      }
      if (scan.status === "completed") {
        item.completed += 1;
      }
    }

    return Array.from(dayMap.values());
  }, [allScans]);

  const projectNameById = useMemo(() => {
    return Object.fromEntries(projects.map((project) => [project.id, project.name]));
  }, [projects]);

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

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <PageShell
      eyebrow="Workspace"
      title="Dashboard"
      description="Track scanner throughput and jump into repositories with one click."
    >
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="rounded-2xl border-slate-300 bg-white">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Security Operations</p>
                </div>
                <CardTitle className="text-lg">Repository scanning control center</CardTitle>
                <CardDescription>Track scanner throughput and jump into repositories with one click.</CardDescription>
              </div>
              <div className="rounded-full bg-slate-100 p-2.5 text-slate-700">
                <ShieldAlert className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile icon={FolderGit2} label="Repositories" value={summary.repositories} />
              <StatTile icon={ScanSearch} label="Total scans" value={summary.scans} />
              <StatTile icon={ShieldCheck} label="Completed" value={summary.completed} />
              <StatTile icon={ShieldX} label="Failed" value={summary.failed} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-slate-100/90 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Completion rate</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className="text-lg font-semibold text-slate-900">{completionRate}%</p>
                  <p className="text-[11px] text-slate-500">{summary.completed} of {summary.scans || 0} scans</p>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${completionRate}%` }} />
                </div>
              </div>
              <div className="rounded-xl bg-slate-100/90 px-3 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Failure rate</p>
                <div className="mt-1 flex items-end justify-between gap-2">
                  <p className="text-lg font-semibold text-slate-900">{failureRate}%</p>
                  <p className="text-[11px] text-slate-500">{summary.failed} failed scans</p>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-rose-500" style={{ width: `${failureRate}%` }} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-300 bg-white">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Pipeline</p>
                </div>
                <CardTitle className="text-lg">Live pipeline</CardTitle>
                <CardDescription>Current queue depth and most recent processing activity.</CardDescription>
              </div>
              <div className="rounded-full bg-slate-100 p-2.5 text-slate-700">
                <ScanSearch className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-slate-100/90 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Active scans</p>
              <div className="mt-1 flex items-end justify-between gap-2">
                <p className="text-lg font-semibold text-slate-900">{summary.running}</p>
                <p className="text-[11px] text-slate-500">Queued + running</p>
              </div>
              <p className="mt-2 text-[11px] text-slate-600">Queued and running scans across all repositories.</p>
            </div>
            <div className="rounded-xl bg-slate-100/90 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Last activity</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatDateTime(recentScans[0]?.created_at ?? null)}</p>
              <p className="mt-2 text-[11px] text-slate-600">Most recent scan creation timestamp.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-300 bg-white">
          <CardHeader className="space-y-3 pb-2">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Charts</p>
              </div>
              <CardTitle className="text-lg">Status Distribution</CardTitle>
              <CardDescription>Current scan volume split by lifecycle state.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusDistributionChart data={statusChartData} total={summary.scans} />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-300 bg-white">
          <CardHeader className="space-y-3 pb-2">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Charts</p>
              </div>
              <CardTitle className="text-lg">7-Day Scan Volume</CardTitle>
              <CardDescription>Created scans per day, with completed and failed overlays.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <WeeklyVolumeChart data={scanTrendData} />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-slate-300 bg-white">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Repository Index</p>
                </div>
                <CardTitle className="text-lg">Repositories</CardTitle>
                <CardDescription>Open details or start a new scan from any repository.</CardDescription>
              </div>
              <div className="rounded-full bg-slate-100 p-2.5 text-slate-700">
                <FolderGit2 className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {projectRows.length === 0 ? <p className="text-xs text-slate-500">No repositories yet.</p> : null}
            {projectRows.map(({ project, scanCount, latestScan }) => (
              <div className="rounded-xl bg-slate-100/90 p-3" key={project.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <Link className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-900 hover:text-slate-700" href={`/projects/${project.id}`}>
                      {project.name}
                    </Link>
                    <p className="text-[11px] text-slate-500 break-all">{project.repo_url || "No repository source configured"}</p>
                    <p className="text-[11px] text-slate-500">
                      {scanCount} scan{scanCount === 1 ? "" : "s"} • Last: {formatDateTime(latestScan?.created_at ?? null)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {latestScan ? <Badge variant={mapStatusVariant(latestScan.status)}>{latestScan.status}</Badge> : null}
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
            ))}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-300 bg-white">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Scan Timeline</p>
                </div>
                <CardTitle className="text-lg">Recent Scans</CardTitle>
                <CardDescription>Latest scans across all repositories.</CardDescription>
              </div>
              <div className="rounded-full bg-slate-100 p-2.5 text-slate-700">
                <ScanSearch className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentScans.length === 0 ? <p className="text-xs text-slate-500">No scans yet.</p> : null}
            {recentScans.map((scan) => (
              <Link className="block rounded-xl bg-slate-100/90 p-3" href={`/scans/${scan.id}`} key={scan.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-900">Scan #{scan.id}</p>
                    <p className="text-[11px] text-slate-500">{projectNameById[scan.project] ?? `Project #${scan.project}`}</p>
                    <p className="text-[11px] text-slate-500">Created {formatDateTime(scan.created_at)}</p>
                  </div>
                  <Badge variant={mapStatusVariant(scan.status)}>{scan.status}</Badge>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

    </PageShell>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-3 h-7 w-72 max-w-full" />
          <Skeleton className="mt-2 h-4 w-80 max-w-full" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-36 w-full" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-3">
          <Skeleton className="h-4 w-36" />
          <Skeleton className="h-36 w-full" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-2">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}

function StatusDistributionChart({ data, total }: { data: StatusChartItem[]; total: number }) {
  if (total === 0) {
    return <p className="text-xs text-slate-500">No scans yet to chart.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-200">
        {data.map((item) => (
          <div className={item.colorClass} key={item.key} style={{ width: `${(item.count / total) * 100}%` }} />
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {data.map((item) => {
          const percentage = Math.round((item.count / total) * 100);
          return (
            <div className="flex items-center justify-between rounded-xl bg-slate-100/90 px-3 py-2" key={item.key}>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${item.colorClass}`} />
                <p className="text-xs text-slate-700">{item.label}</p>
              </div>
              <p className="text-xs font-semibold text-slate-900">
                {item.count} ({percentage}%)
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeeklyVolumeChart({
  data,
}: {
  data: Array<{
    label: string;
    total: number;
    failed: number;
    completed: number;
  }>;
}) {
  const maxTotal = Math.max(...data.map((item) => item.total), 1);

  return (
    <div className="space-y-3">
      <div className="grid h-44 grid-cols-7 items-end gap-2 rounded-xl bg-slate-100/90 p-3">
        {data.map((item, idx) => {
          const totalHeight = Math.max(8, Math.round((item.total / maxTotal) * 100));
          const completedHeight = item.total > 0 ? Math.max(2, Math.round((item.completed / item.total) * totalHeight)) : 0;
          const failedHeight = item.total > 0 ? Math.max(2, Math.round((item.failed / item.total) * totalHeight)) : 0;
          const overflow = completedHeight + failedHeight > totalHeight;
          const adjustedFailed = overflow ? Math.max(0, failedHeight - (completedHeight + failedHeight - totalHeight)) : failedHeight;
          return (
            <div className="flex flex-col items-center gap-2" key={`${item.label}-${idx}`}>
              <div className="relative flex h-28 w-full max-w-[30px] items-end justify-center rounded-md bg-slate-200/70">
                <div className="w-5 rounded-t-sm bg-slate-400" style={{ height: `${totalHeight}%` }} />
                {item.completed > 0 ? (
                  <div className="absolute bottom-0 w-5 rounded-t-sm bg-emerald-500" style={{ height: `${completedHeight}%` }} />
                ) : null}
                {adjustedFailed > 0 ? (
                  <div className="absolute bottom-0 w-5 rounded-t-sm bg-rose-500/90" style={{ height: `${adjustedFailed}%` }} />
                ) : null}
              </div>
              <div className="text-center">
                <p className="text-[11px] font-semibold text-slate-800">{item.label}</p>
                <p className="text-[10px] text-slate-500">{item.total}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600">
        <LegendDot className="bg-slate-400" label="Total" />
        <LegendDot className="bg-emerald-500" label="Completed" />
        <LegendDot className="bg-rose-500" label="Failed" />
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}
