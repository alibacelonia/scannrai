"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Clock3, Link2, PlayCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/page-shell";
import { OpsCard, OpsMetricCard, OpsPanel } from "@/components/ui/ops-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createScan, getProject, listProjectScans } from "@/lib/api";
import type { Project, Scan } from "@/types/api";

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

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projectData, scansData] = await Promise.all([getProject(projectId), listProjectScans(projectId)]);
      setProject(projectData);
      setScans(scansData.results);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Unable to load project.");
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const runScan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRunning(true);
    try {
      if (!project?.repo_url) {
        throw new ApiError("Set a repository source path or URL first.", 400);
      }
      const scan = await createScan(projectId);
      await loadData();
      router.push(`/scans/${scan.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Unable to start scan.");
      }
    } finally {
      setRunning(false);
    }
  };

  const stats = useMemo(() => {
    return {
      total: scans.length,
      running: scans.filter((scan) => scan.status === "running" || scan.status === "queued").length,
      completed: scans.filter((scan) => scan.status === "completed").length,
      failed: scans.filter((scan) => scan.status === "failed").length,
    };
  }, [scans]);

  if (loading) {
    return <ProjectSkeleton />;
  }

  if (!project) {
    return (
      <PageShell eyebrow="Repository" title="Project not found" description="The repository could not be loaded.">
        <OpsPanel className="rounded-2xl border border-slate-300 bg-white">
          <div className="pt-2">
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">Project not found.</p>
          </div>
        </OpsPanel>
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow="Repository" title={project.name} description="Trigger scans and review repository scan timeline.">
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="Total scans" value={stats.total} icon={Clock3} />
        <Metric label="Active" value={stats.running} icon={PlayCircle} />
        <Metric label="Completed" value={stats.completed} icon={ShieldAlert} />
        <Metric label="Failed" value={stats.failed} icon={ShieldAlert} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <OpsCard
          chipDotClassName="bg-cyan-500"
          chipLabel="Source Config"
          description="Current source used by worker-scoped scan jobs."
          icon={Link2}
          title="Repository Source"
          contentClassName="space-y-4"
        >
            <OpsPanel className="px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Configured source</p>
              <p className="mt-1 break-all text-xs text-[var(--ink)]">{project.repo_url || "No source configured"}</p>
            </OpsPanel>

            <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={runScan}>
              <p className="self-center text-xs text-[var(--ink-muted)]">Scan runs asynchronously through Celery + Redis queue.</p>
              <Button disabled={running} type="submit">
                <PlayCircle className="mr-2 h-4 w-4" />
                {running ? "Queueing..." : "Run scan"}
              </Button>
            </form>

            <OpsPanel className="px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Accepted source types</p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">Local git repository folder, local `.zip`, or remote git URL.</p>
            </OpsPanel>
        </OpsCard>

        <OpsCard
          chipDotClassName="bg-emerald-500"
          chipLabel="Scan Timeline"
          description="Latest runs for this repository."
          icon={Clock3}
          title="Recent scans"
          contentClassName="space-y-2"
        >
            {scans.length === 0 ? <p className="text-xs text-[var(--ink-muted)]">No scans yet.</p> : null}
            {scans.map((scan) => (
              <Link
                className="block rounded-xl bg-slate-100/90 p-3 transition"
                href={`/scans/${scan.id}`}
                key={scan.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">Scan #{scan.id}</p>
                    <p className="mt-1 text-[11px] text-[var(--ink-muted)]">{formatUtcTimestamp(scan.created_at)}</p>
                  </div>
                  <Badge variant={statusVariant(scan.status)}>{scan.status}</Badge>
                </div>
                {scan.commit_hash ? (
                  <p className="mt-2 inline-flex items-center text-[11px] text-[var(--ink-subtle)]">
                    <Link2 className="mr-1 h-3.5 w-3.5" />
                    {scan.commit_hash.slice(0, 12)}
                  </p>
                ) : null}
              </Link>
            ))}
        </OpsCard>
      </section>
    </PageShell>
  );
}

function Metric({
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

function ProjectSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-300 bg-white p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-52" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3 rounded-2xl border border-slate-300 bg-white p-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
        <div className="space-y-2 rounded-2xl border border-slate-300 bg-white p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}
