"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderGit2, TimerReset, Waves } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, listProjects, listProjectScans } from "@/lib/api";
import type { Project } from "@/types/api";

type ProjectScanSummary = {
  total: number;
  running: number;
  queued: number;
  failed: number;
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [scanSummary, setScanSummary] = useState<Record<number, ProjectScanSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      <Card>
        <CardHeader>
          <CardTitle>Repositories</CardTitle>
          <CardDescription>Open repository details and scan history.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {projects.length === 0 ? <p className="text-xs text-[var(--ink-muted)]">No repositories configured yet.</p> : null}
          {projects.map((project) => {
            const summary = scanSummary[project.id] ?? { total: 0, running: 0, queued: 0, failed: 0 };
            return (
              <Link
                className="block rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/65 p-3 transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"
                href={`/projects/${project.id}`}
                key={project.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink)]">{project.name}</p>
                    <p className="mt-1 break-all text-[11px] text-[var(--ink-muted)]">{project.repo_url || "No repository source configured"}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Badge variant={summary.running > 0 ? "warning" : "default"}>{summary.running} running</Badge>
                    <Badge variant={summary.queued > 0 ? "warning" : "default"}>{summary.queued} queued</Badge>
                    <Badge variant={summary.failed > 0 ? "danger" : "default"}>{summary.failed} failed</Badge>
                    <Badge variant="default">{summary.total} total</Badge>
                  </div>
                </div>
              </Link>
            );
          })}
          {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p> : null}
        </CardContent>
      </Card>
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
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">{label}</p>
          <Icon className="h-4 w-4 text-[var(--ink-subtle)]" />
        </div>
        <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{value}</p>
      </CardContent>
    </Card>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="space-y-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <Skeleton className="h-3 w-28" />
        {Array.from({ length: 3 }).map((_, idx) => (
          <Skeleton className="h-16 w-full" key={`project-row-${idx}`} />
        ))}
      </div>
    </div>
  );
}
