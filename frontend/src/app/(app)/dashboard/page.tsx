"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderGit2, GitBranch, Laptop, Loader2, PlayCircle, ScanSearch, ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

function isDuplicateRepoError(error: ApiError): boolean {
  return error.status === 400 && error.message.toLowerCase().includes("already exists");
}

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
  const localFolderPickerRef = useRef<HTMLInputElement | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectScans, setProjectScans] = useState<Record<number, Scan[]>>({});
  const [loading, setLoading] = useState(true);

  const [remoteRepoUrl, setRemoteRepoUrl] = useState("");
  const [localSourcePath, setLocalSourcePath] = useState("");
  const [localSourceCandidates, setLocalSourceCandidates] = useState<string[]>([]);
  const [selectedLocalFolder, setSelectedLocalFolder] = useState<string | null>(null);
  const [remoteOpening, setRemoteOpening] = useState(false);
  const [localOpening, setLocalOpening] = useState(false);
  const [localValidating, setLocalValidating] = useState(false);
  const [startingProjectId, setStartingProjectId] = useState<number | null>(null);
  const [folderPickerDialogOpen, setFolderPickerDialogOpen] = useState(false);

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
    const running = allScans.filter((scan) => scan.status === "running" || scan.status === "queued").length;
    const completed = allScans.filter((scan) => scan.status === "completed").length;
    const failed = allScans.filter((scan) => scan.status === "failed").length;
    return {
      repositories: projects.length,
      scans: allScans.length,
      running,
      completed,
      failed,
    };
  }, [allScans, projects.length]);
  const completionRate = summary.scans > 0 ? Math.round((summary.completed / summary.scans) * 100) : 0;
  const failureRate = summary.scans > 0 ? Math.round((summary.failed / summary.scans) * 100) : 0;

  const projectNameById = useMemo(() => {
    return Object.fromEntries(projects.map((project) => [project.id, project.name]));
  }, [projects]);

  const localPathHint = selectedLocalFolder
    ? `/host/home/.../${selectedLocalFolder}`
    : "/host/home/.../repo, /Users/.../repo, or local .zip path";

  const validateLocalSource = useCallback(async (sourcePath: string): Promise<{ sourceToSave: string }> => {
    const validation = await validateRepositorySource(sourcePath);
    if (validation.kind !== "local_git" && validation.kind !== "local_zip") {
      throw new ApiError("Selected source must be a local git repository folder or local .zip path.", 400);
    }
    return {
      sourceToSave: validation.resolved_path ?? sourcePath,
    };
  }, []);

  const validateRemoteSource = useCallback(async (sourceUrl: string): Promise<{ sourceToSave: string }> => {
    const validation = await validateRepositorySource(sourceUrl);
    if (validation.kind !== "remote_git") {
      throw new ApiError(
        "Remote source must be a git repository URL (example: https://github.com/<owner>/<repo>).",
        400,
      );
    }
    return {
      sourceToSave: validation.reference ?? sourceUrl,
    };
  }, []);

  const openRemoteRepository = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRemoteOpening(true);
    try {
      const source = remoteRepoUrl.trim();
      const { sourceToSave } = await validateRemoteSource(source);
      const project = await createProject(deriveNameFromRepoUrl(sourceToSave), sourceToSave);
      setRemoteRepoUrl("");
      router.push(`/projects/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (isDuplicateRepoError(err)) {
          toast.error(`${err.message} Open the existing repository from the list instead of creating another one.`);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Unable to open repository.");
      }
    } finally {
      setRemoteOpening(false);
    }
  };

  const openLocalRepository = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!localSourcePath.trim()) {
      toast.error("Enter a local repository path first.");
      return;
    }

    setLocalOpening(true);
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
        if (isDuplicateRepoError(err)) {
          toast.error(`${err.message} Open the existing repository from the list instead of creating another one.`);
        } else {
          toast.error(err.message);
        }
      } else {
        toast.error("Unable to open local repository.");
      }
    } finally {
      setLocalOpening(false);
    }
  };

  const discoverFromSelectedFolderName = useCallback((rootFolder: string) => {
    const fallbackHint = `/host/home/.../${rootFolder} or /Users/.../${rootFolder}`;
    setLocalSourceCandidates([]);
    setSelectedLocalFolder(rootFolder);
    setLocalValidating(true);
    void discoverRepositorySource(rootFolder)
      .then((result) => {
        if (result.candidates.length === 1) {
          setLocalSourcePath(result.candidates[0]);
          toast.info(`Resolved local source path automatically: ${result.candidates[0]}`);
          return;
        }
        if (result.candidates.length > 1) {
          setLocalSourceCandidates(result.candidates);
          setLocalSourcePath(result.candidates[0]);
          toast.info("Multiple matching local sources found. Choose the correct path below.");
          return;
        }
        setLocalSourcePath("");
        toast.error(
          `Folder "${rootFolder}" selected, but browser did not expose absolute path and no matches were auto-discovered. Enter full source path manually (example: ${fallbackHint}).`,
        );
      })
      .catch((err) => {
        setLocalSourcePath("");
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error(`Folder "${rootFolder}" selected, but browser did not expose absolute path. Enter full source path manually (example: ${fallbackHint}).`);
        }
      })
      .finally(() => setLocalValidating(false));
  }, []);

  const chooseLocalRepositoryFolder = () => {
    setFolderPickerDialogOpen(true);
  };

  const confirmLocalRepositoryFolderSelection = () => {
    setFolderPickerDialogOpen(false);
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

    const inferredAbsolutePath = inferAbsoluteFolderPath(files);
    if (inferredAbsolutePath) {
      setLocalSourcePath(inferredAbsolutePath);
      setLocalValidating(true);
      void validateLocalSource(inferredAbsolutePath)
        .then(() => toast.info(`Selected folder resolved to: ${inferredAbsolutePath}`))
        .catch((err) => {
          if (err instanceof ApiError) {
            toast.error(err.message);
          } else {
            toast.error("Selected folder is not a valid repository source.");
          }
        })
        .finally(() => setLocalValidating(false));
      return;
    }

    const hasDirectoryStructure = files.some((file) => getRelativePath(file).includes("/"));
    if (!hasDirectoryStructure) {
      toast.error("Could not determine folder path from selection. Paste the local repository path manually.");
      return;
    }
    discoverFromSelectedFolderName(rootFolder);
  };

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
      description="Manage repositories and trigger background scans from remote URLs or local repository paths."
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

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="rounded-2xl border-slate-300 bg-white">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Repository Input</p>
                </div>
                <CardTitle className="text-lg">Open Remote Repository</CardTitle>
                <CardDescription>Connect a public git URL and start tracking scans.</CardDescription>
              </div>
              <div className="rounded-full bg-slate-100 p-2.5 text-slate-700">
                <GitBranch className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={openRemoteRepository}>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Remote URL</label>
                <Input
                  onChange={(event) => setRemoteRepoUrl(event.target.value)}
                  placeholder="https://github.com/org/repo"
                  value={remoteRepoUrl}
                />
              </div>
              <Button className="w-full" disabled={remoteOpening || !remoteRepoUrl.trim()} type="submit">
                {remoteOpening ? (
                  <>
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    Opening...
                  </>
                ) : (
                  "Open remote"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-300 bg-white">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-2.5 py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">Local Source</p>
                </div>
                <CardTitle className="text-lg">Open Local Repository</CardTitle>
                <CardDescription>Pick a folder or paste a container-visible local path.</CardDescription>
              </div>
              <div className="rounded-full bg-slate-100 p-2.5 text-slate-700">
                <Laptop className="h-5 w-5" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              className="hidden"
              ref={localFolderPickerRef}
              type="file"
              multiple
              webkitdirectory=""
              directory=""
              onChange={handleLocalFolderSelection}
            />
            <form className="space-y-3" onSubmit={openLocalRepository}>
              <div className="space-y-1">
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Local source path</label>
                <Input
                  onChange={(event) => setLocalSourcePath(event.target.value)}
                  placeholder={selectedLocalFolder ? localPathHint : "/host/home/.../repo, /Users/.../repo, or /.../repo.zip"}
                  value={localSourcePath}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={chooseLocalRepositoryFolder} type="button" variant="outline">
                  Select folder
                </Button>
                <Button className="w-full" disabled={localOpening || localValidating || !localSourcePath.trim()} type="submit">
                  {localValidating ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Validating...
                    </>
                  ) : localOpening ? (
                    <>
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      Opening...
                    </>
                  ) : (
                    "Open local"
                  )}
                </Button>
              </div>
            </form>
            <p className="text-[11px] text-slate-500">
              Local source is path-based and validated before opening. Use a git repository folder path or a local .zip path.
            </p>
            {selectedLocalFolder ? (
              <p className="text-[11px] text-slate-500">
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
                      className="h-auto w-full justify-start px-3 py-2 text-left text-[11px] normal-case tracking-normal"
                      onClick={() => {
                        setLocalSourcePath(candidate);
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

      <Dialog open={folderPickerDialogOpen} onOpenChange={setFolderPickerDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Local Folder</DialogTitle>
            <DialogDescription>
              Continue to open your system folder picker. If full path access is restricted by browser rules, we will auto-discover matching
              repository paths and let you choose.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 px-5 pb-5 pt-2">
            <Button onClick={() => setFolderPickerDialogOpen(false)} size="sm" type="button" variant="outline">
              Cancel
            </Button>
            <Button onClick={confirmLocalRepositoryFolderSelection} size="sm" type="button">
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
