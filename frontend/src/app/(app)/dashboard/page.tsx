"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, createProject, listProjectScans, listProjects } from "@/lib/api";
import type { Project, Scan } from "@/types/api";

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectScans, setProjectScans] = useState<Record<number, Scan[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
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
        setError(err.message);
      } else {
        setError("Unable to load dashboard.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const recentScans = useMemo(
    () =>
      Object.values(projectScans)
        .flat()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6),
    [projectScans],
  );

  const handleCreateProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await createProject(name, repoUrl);
      setName("");
      setRepoUrl("");
      await loadData();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to create project.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create project</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-3" onSubmit={handleCreateProject}>
              <Input onChange={(event) => setName(event.target.value)} placeholder="Project name" value={name} />
              <Input
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="Repo URL (optional)"
                value={repoUrl}
              />
              <Button disabled={saving || !name.trim()} type="submit">
                {saving ? "Creating..." : "Create"}
              </Button>
            </form>
            {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-[var(--ink-muted)]">
            <p>Projects: <span className="font-semibold text-[var(--ink)]">{projects.length}</span></p>
            <p>Recent scans: <span className="font-semibold text-[var(--ink)]">{recentScans.length}</span></p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-[var(--ink-muted)]">Loading projects...</p> : null}
            {!loading && projects.length === 0 ? <p className="text-sm text-[var(--ink-muted)]">No projects yet.</p> : null}
            <div className="space-y-3">
              {projects.map((project) => (
                <Link
                  className="block rounded-xl border border-[var(--border)] p-3 hover:bg-[var(--muted)]"
                  href={`/projects/${project.id}`}
                  key={project.id}
                >
                  <p className="font-medium">{project.name}</p>
                  <p className="text-xs text-[var(--ink-muted)]">{project.repo_url || "ZIP uploads supported"}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent scans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentScans.length === 0 ? <p className="text-sm text-[var(--ink-muted)]">No scans yet.</p> : null}
            {recentScans.map((scan) => (
              <Link
                className="flex items-center justify-between rounded-xl border border-[var(--border)] p-3 hover:bg-[var(--muted)]"
                href={`/scans/${scan.id}`}
                key={scan.id}
              >
                <div>
                  <p className="font-medium">Scan #{scan.id}</p>
                  <p className="text-xs text-[var(--ink-muted)]">Project #{scan.project}</p>
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
    </div>
  );
}
