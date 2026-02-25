"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    return <p className="text-sm text-[var(--ink-muted)]">Loading project...</p>;
  }

  if (!project) {
    return <p className="text-sm text-[var(--danger)]">Project not found.</p>;
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>{project.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-[var(--ink-muted)]">Repository source: {project.repo_url || "No source configured"}</p>
          <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={runScan}>
            <p className="self-center text-xs text-[var(--ink-muted)]">Scan runs in background via worker queue (Celery + Redis).</p>
            <Button disabled={running} type="submit">
              {running ? "Queueing..." : "Run scan"}
            </Button>
          </form>
          <p className="text-xs text-[var(--ink-muted)]">Use a local git repository path, local zip path, or remote git URL as the project source.</p>
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scans</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {scans.length === 0 ? <p className="text-sm text-[var(--ink-muted)]">No scans yet.</p> : null}
          {scans.map((scan) => (
            <Link
              className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 hover:bg-[var(--muted)]"
              href={`/scans/${scan.id}`}
              key={scan.id}
            >
              <div>
                <p className="font-medium">Scan #{scan.id}</p>
                <p className="text-xs text-[var(--ink-muted)]">{formatUtcTimestamp(scan.created_at)}</p>
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
    </div>
  );
}
