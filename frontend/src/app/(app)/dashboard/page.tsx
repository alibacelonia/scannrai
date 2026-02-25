"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApiError,
  createProject,
  createScan,
  discoverRepositorySource,
  listProjectScans,
  listProjects,
  validateRepositorySource,
} from "@/lib/api";
import type { Project, Scan } from "@/types/api";

type PickerFile = File & {
  webkitRelativePath?: string;
  path?: string;
};

function normalizeProjectName(candidate: string): string {
  const trimmed = candidate.trim();
  if (!trimmed) {
    return "repository";
  }
  return trimmed.slice(0, 255);
}

function deriveNameFromRepoUrl(repoUrl: string): string {
  const trimmed = repoUrl.trim();
  try {
    const parsed = new URL(trimmed);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const owner = parts[0];
      const repo = parts[1].replace(/\.git$/i, "");
      return normalizeProjectName(`${owner}/${repo}`);
    }
    if (parts.length === 1) {
      return normalizeProjectName(parts[0].replace(/\.git$/i, ""));
    }
    return normalizeProjectName(parsed.hostname);
  } catch {
    return normalizeProjectName(trimmed.replace(/\.git$/i, ""));
  }
}

function deriveNameFromLocalSource(sourcePath: string): string {
  const normalized = sourcePath.trim().replace(/\\/g, "/").replace(/\/+$/, "");
  if (!normalized) {
    return "repository";
  }
  const parts = normalized.split("/").filter(Boolean);
  const lastPart = parts[parts.length - 1] ?? normalized;
  return normalizeProjectName(lastPart.replace(/\.zip$/i, ""));
}

function getRelativePath(file: PickerFile): string {
  return (file.webkitRelativePath || file.name || "").replace(/\\/g, "/");
}

function inferAbsoluteFolderPath(files: PickerFile[]): string | null {
  for (const file of files) {
    if (!file.path) continue;
    const absoluteFilePath = file.path.replace(/\\/g, "/");
    const relativePath = getRelativePath(file);
    if (!relativePath) continue;
    if (absoluteFilePath.endsWith(relativePath)) {
      return absoluteFilePath.slice(0, absoluteFilePath.length - relativePath.length).replace(/\/+$/, "");
    }
  }
  return null;
}

export default function DashboardPage() {
  const router = useRouter();
  const localFolderPickerRef = useRef<HTMLInputElement | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectScans, setProjectScans] = useState<Record<number, Scan[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [remoteRepoUrl, setRemoteRepoUrl] = useState("");
  const [localSourcePath, setLocalSourcePath] = useState("");
  const [localSourceCandidates, setLocalSourceCandidates] = useState<string[]>([]);
  const [selectedLocalFolder, setSelectedLocalFolder] = useState<string | null>(null);
  const [remoteOpening, setRemoteOpening] = useState(false);
  const [localOpening, setLocalOpening] = useState(false);
  const [localValidating, setLocalValidating] = useState(false);

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

  const localPathHint = selectedLocalFolder
    ? `/host/home/personal-projects/${selectedLocalFolder}`
    : "/host/home/personal-projects/<repo-folder>";

  const validateLocalSource = useCallback(async (sourcePath: string): Promise<{
    kind: string;
    sourceToSave: string;
  }> => {
    const validation = await validateRepositorySource(sourcePath);
    if (validation.kind !== "local_git" && validation.kind !== "local_zip") {
      throw new ApiError("Selected source must be a local git repository folder or local .zip path.", 400);
    }
    return {
      kind: validation.kind,
      sourceToSave: validation.resolved_path ?? sourcePath,
    };
  }, []);

  const openRemoteRepository = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRemoteOpening(true);
    setError(null);
    try {
      const project = await createProject(deriveNameFromRepoUrl(remoteRepoUrl), remoteRepoUrl.trim());
      setRemoteRepoUrl("");
      router.push(`/projects/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to open repository.");
      }
    } finally {
      setRemoteOpening(false);
    }
  };

  const openLocalRepository = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!localSourcePath.trim()) {
      setError("Enter a local repository path first.");
      return;
    }

    setLocalOpening(true);
    setError(null);
    try {
      const source = localSourcePath.trim();
      const { sourceToSave } = await validateLocalSource(source);
      const project = await createProject(deriveNameFromLocalSource(sourceToSave), sourceToSave);
      const scan = await createScan(String(project.id));
      setLocalSourcePath("");
      setLocalSourceCandidates([]);
      setSelectedLocalFolder(null);
      router.push(`/scans/${scan.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to open local repository.");
      }
    } finally {
      setLocalOpening(false);
    }
  };

  const chooseLocalRepositoryFolder = () => {
    localFolderPickerRef.current?.click();
  };

  const handleLocalFolderSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []) as PickerFile[];
    event.target.value = "";
    if (files.length === 0) {
      return;
    }

    const firstRelativePath = getRelativePath(files[0]);
    const rootFolder = normalizeProjectName(firstRelativePath.split("/").filter(Boolean)[0] || files[0].name || "repository");
    const fallbackHint = `/host/home/personal-projects/${rootFolder}`;
    setLocalSourceCandidates([]);
    setSelectedLocalFolder(rootFolder);

    const inferredAbsolutePath = inferAbsoluteFolderPath(files);
    if (inferredAbsolutePath) {
      setLocalSourcePath(inferredAbsolutePath);
      setLocalValidating(true);
      void validateLocalSource(inferredAbsolutePath)
        .then(() => setError(null))
        .catch((err) => {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("Selected folder is not a valid repository source.");
          }
        })
        .finally(() => setLocalValidating(false));
      return;
    }

    const hasDirectoryStructure = files.some((file) => getRelativePath(file).includes("/"));
    if (!hasDirectoryStructure) {
      setError("Could not determine folder path from selection. Paste the local repository path manually.");
      return;
    }

    setLocalValidating(true);
    void discoverRepositorySource(rootFolder)
      .then((result) => {
        if (result.candidates.length === 1) {
          setLocalSourcePath(result.candidates[0]);
          setError(`Resolved local source path automatically: ${result.candidates[0]}`);
          return;
        }
        if (result.candidates.length > 1) {
          setLocalSourceCandidates(result.candidates);
          setLocalSourcePath(result.candidates[0]);
          setError("Multiple matching local sources found. Choose the correct path below.");
          return;
        }
        setLocalSourcePath("");
        setError(
          `Folder "${rootFolder}" selected, but browser did not expose absolute path and no matches were auto-discovered. Enter full container-visible path manually (example: ${fallbackHint}).`,
        );
      })
      .catch((err) => {
        setLocalSourcePath("");
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(
            `Folder "${rootFolder}" selected, but browser did not expose absolute path. Enter full container-visible path manually (example: ${fallbackHint}).`,
          );
        }
      })
      .finally(() => setLocalValidating(false));
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <PageShell
      eyebrow="Workspace"
      title="Repository Dashboard"
      description="Open a remote repository or resolve a local source path for background scans."
    >
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Open Repository</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="grid gap-2 md:grid-cols-[1fr_auto]" onSubmit={openRemoteRepository}>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Remote URL</label>
                <Input
                  onChange={(event) => setRemoteRepoUrl(event.target.value)}
                  placeholder="https://github.com/org/repo"
                  value={remoteRepoUrl}
                />
              </div>
              <Button className="self-end" disabled={remoteOpening || !remoteRepoUrl.trim()} type="submit">
                {remoteOpening ? "Opening..." : "Open remote"}
              </Button>
            </form>

            <form className="grid gap-2 md:grid-cols-[1fr_auto_auto]" onSubmit={openLocalRepository}>
              <input
                className="hidden"
                ref={localFolderPickerRef}
                type="file"
                multiple
                webkitdirectory=""
                directory=""
                onChange={handleLocalFolderSelection}
              />
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Local source path</label>
                <Input
                  onChange={(event) => setLocalSourcePath(event.target.value)}
                  placeholder={selectedLocalFolder ? localPathHint : "/host/home/.../repo or /host/home/.../repo.zip"}
                  value={localSourcePath}
                />
              </div>
              <Button className="self-end" onClick={chooseLocalRepositoryFolder} type="button" variant="outline">
                Select folder
              </Button>
              <Button className="self-end" disabled={localOpening || localValidating || !localSourcePath.trim()} type="submit">
                {localValidating ? "Validating..." : localOpening ? "Opening..." : "Open local"}
              </Button>
            </form>

            <p className="text-xs text-slate-500">
              Local source is path-based. Use a git repository folder path or local .zip path accessible to backend/worker.
            </p>
            {selectedLocalFolder ? (
              <p className="text-xs text-slate-500">
                Selected folder: <span className="font-semibold text-slate-900">{selectedLocalFolder}</span>
              </p>
            ) : null}
            {localSourceCandidates.length > 1 ? (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Discovered paths</p>
                <div className="space-y-2">
                  {localSourceCandidates.map((candidate) => (
                    <Button
                      key={candidate}
                      onClick={() => {
                        setLocalSourcePath(candidate);
                        setError(null);
                      }}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      {candidate}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}
            {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-600">
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Repositories</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{projects.length}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Recent scans</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{recentScans.length}</p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Repositories</CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? <p className="text-xs text-slate-500">No repositories yet.</p> : null}
            <div className="space-y-2">
              {projects.map((project) => (
                <Link
                  className="block rounded-xl border border-slate-200 bg-slate-50/50 p-3 hover:bg-slate-100"
                  href={`/projects/${project.id}`}
                  key={project.id}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-900">{project.name}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{project.repo_url || "No repository source configured"}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentScans.length === 0 ? <p className="text-xs text-slate-500">No scans yet.</p> : null}
            {recentScans.map((scan) => (
              <Link
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3 hover:bg-slate-100"
                href={`/scans/${scan.id}`}
                key={scan.id}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-900">Scan #{scan.id}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Project #{scan.project}</p>
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

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="mt-3 h-7 w-56" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
  );
}
