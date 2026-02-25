"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function ProjectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectData, scansData] = await Promise.all([getProject(projectId), listProjectScans(projectId)]);
      setProject(projectData);
      setScans(scansData.results);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load project.");
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
    setError(null);
    try {
      if (!project?.repo_url) {
        throw new ApiError("Set a repository source path or URL first.", 400);
      }
      const scan = await createScan(projectId);
      await loadData();
      router.push(`/scans/${scan.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to start scan.");
      }
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <ProjectSkeleton />;
  }

  if (!project) {
    return (
      <PageShell eyebrow="Repository" title="Project not found" description="The repository could not be loaded.">
        <Card className="rounded-2xl">
          <CardContent className="pt-5">
            <p className="text-xs font-medium text-red-700">Project not found.</p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell eyebrow="Repository" title={project.name} description="Trigger background scans and review repository scan history.">
      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Repository Source</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Configured Source</p>
              <p className="mt-1 break-all text-xs text-slate-800">{project.repo_url || "No source configured"}</p>
            </div>

            <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={runScan}>
              <p className="self-center text-xs text-slate-600">
                Scan runs in background via worker queue (Celery + Redis).
              </p>
              <Button disabled={running} type="submit">
                {running ? "Queueing..." : "Run scan"}
              </Button>
            </form>

            <p className="text-xs text-slate-500">
              Source accepts a local git repository folder, local `.zip`, or remote git URL.
            </p>
            {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Scans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {scans.length === 0 ? <p className="text-xs text-slate-500">No scans yet.</p> : null}
            {scans.map((scan) => (
              <Link
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3 hover:bg-slate-100"
                href={`/scans/${scan.id}`}
                key={scan.id}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-900">Scan #{scan.id}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{formatUtcTimestamp(scan.created_at)}</p>
                </div>
                <Badge
                  variant={
                    scan.status === "completed"
                      ? "success"
                      : scan.status === "failed"
                        ? "danger"
                        : scan.status === "running"
                          ? "warning"
                          : "default"
                  }
                >
                  {scan.status}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>
    </PageShell>
  );
}

function ProjectSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-52" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-3 w-64 max-w-full" />
        </div>
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}
