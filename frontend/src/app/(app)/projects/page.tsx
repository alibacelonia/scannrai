"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderGit2, Loader2, PlayCircle, TimerReset, Waves } from "lucide-react";
import { toast } from "sonner";

import { RepositoryOpenActions } from "@/components/repository-open-actions";
import { PageShell } from "@/components/page-shell";
import { OpsCard, OpsMetricCard, OpsPanel } from "@/components/ui/ops-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, createScan, listProjects, listProjectScans } from "@/lib/api";
import type { Project } from "@/types/api";

type ProjectScanSummary = {
  total: number;
  running: number;
  queued: number;
  failed: number;
};

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [scanSummary, setScanSummary] = useState<Record<number, ProjectScanSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingProjectId, setStartingProjectId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projectPage = await listProjects();
      setProjects(projectPage.results);
      const summaries = await Promise.all(
        projectPage.results.map(async (project) => {
          const scansPage = await listProjectScans(String(project.id));
          const scans = scansPage.results;
          return [
            project.id,
            {
              total: scans.length,
              running: scans.filter((scan) => scan.status === "running").length,
              queued: scans.filter((scan) => scan.status === "queued").length,
              failed: scans.filter((scan) => scan.status === "failed").length,
            },
          ] as const;
        }),
      );
      setScanSummary(Object.fromEntries(summaries));
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load repositories.");
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

  const totals = useMemo(() => {
    const values = Object.values(scanSummary);
    return {
      repositories: projects.length,
      active: values.reduce((sum, item) => sum + item.running + item.queued, 0),
      failed: values.reduce((sum, item) => sum + item.failed, 0),
    };
  }, [projects.length, scanSummary]);

  if (loading) {
    return <ProjectsSkeleton />;
  }

  return (
    <PageShell eyebrow="Repositories" title="Repository Inventory" description="All configured repositories and scan queue status.">
      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard icon={FolderGit2} label="Repositories" value={totals.repositories} />
        <SummaryCard icon={TimerReset} label="Active queue" value={totals.active} />
        <SummaryCard icon={Waves} label="Failed scans" value={totals.failed} />
      </section>

      <RepositoryOpenActions onCreated={loadData} />

      <OpsCard
        chipDotClassName="bg-violet-500"
        chipLabel="Repository Index"
        description="Open repository details and run scans directly from this page."
        icon={FolderGit2}
        title="Repositories"
        contentClassName="space-y-2"
      >
          {projects.length === 0 ? <p className="text-xs text-[var(--ink-muted)]">No repositories configured yet.</p> : null}
          {projects.map((project) => {
            const summary = scanSummary[project.id] ?? { total: 0, running: 0, queued: 0, failed: 0 };
            return (
              <div className="rounded-xl bg-slate-100/90 p-3" key={project.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)]" href={`/projects/${project.id}`}>
                      {project.name}
                    </Link>
                    <p className="mt-1 break-all text-[11px] text-[var(--ink-muted)]">{project.repo_url || "No repository source configured"}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Badge variant={summary.running > 0 ? "warning" : "default"}>{summary.running} running</Badge>
                    <Badge variant={summary.queued > 0 ? "warning" : "default"}>{summary.queued} queued</Badge>
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
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p> : null}
      </OpsCard>
    </PageShell>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <OpsMetricCard icon={Icon} label={label} value={value} />
  );
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-300 bg-white p-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <OpsPanel className="space-y-2 rounded-2xl">
        <Skeleton className="h-3 w-28" />
        {Array.from({ length: 3 }).map((_, idx) => (
          <Skeleton className="h-16 w-full" key={`project-row-${idx}`} />
        ))}
      </OpsPanel>
    </div>
  );
}
