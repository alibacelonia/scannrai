"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, listProjects, listProjectScans } from "@/lib/api";
import type { Project } from "@/types/api";

type ProjectScanSummary = {
  total: number;
  running: number;
  queued: number;
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

  if (loading) {
    return <ProjectsSkeleton />;
  }

  return (
    <PageShell eyebrow="Repositories" title="All Repositories" description="Browse configured repositories and jump into scan history.">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Repositories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {projects.length === 0 ? <p className="text-xs text-slate-500">No repositories configured yet.</p> : null}
          {projects.map((project) => {
            const summary = scanSummary[project.id] ?? { total: 0, running: 0, queued: 0 };
            return (
              <Link
                className="block rounded-xl border border-slate-200 bg-slate-50/60 p-3 hover:bg-slate-100"
                href={`/projects/${project.id}`}
                key={project.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-900">{project.name}</p>
                    <p className="mt-1 break-all text-[11px] text-slate-500">{project.repo_url || "No repository source configured"}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Badge variant={summary.running > 0 ? "warning" : "default"}>{summary.running} running</Badge>
                    <Badge variant={summary.queued > 0 ? "warning" : "default"}>{summary.queued} queued</Badge>
                    <Badge variant="default">{summary.total} total</Badge>
                  </div>
                </div>
              </Link>
            );
          })}
          {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function ProjectsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="mt-3 h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-3 w-28" />
        {Array.from({ length: 3 }).map((_, idx) => (
          <Skeleton className="h-16 w-full" key={`project-row-${idx}`} />
        ))}
      </div>
    </div>
  );
}
