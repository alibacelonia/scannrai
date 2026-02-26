"use client";

import { ChangeEvent, FormEvent, useCallback, useRef, useState } from "react";
import { GitBranch, Laptop, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { ApiError, createProject, discoverRepositorySource, validateRepositorySource } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/api";

import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { OpsCard } from "./ui/ops-card";

type PickerFile = File & {
  webkitRelativePath?: string;
  path?: string;
};

type RepositoryOpenActionsProps = {
  className?: string;
  onCreated?: (project: Project) => void | Promise<void>;
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

export function RepositoryOpenActions({ className, onCreated }: RepositoryOpenActionsProps) {
  const localFolderPickerRef = useRef<HTMLInputElement | null>(null);

  const [remoteRepoUrl, setRemoteRepoUrl] = useState("");
  const [localSourcePath, setLocalSourcePath] = useState("");
  const [localSourceCandidates, setLocalSourceCandidates] = useState<string[]>([]);
  const [selectedLocalFolder, setSelectedLocalFolder] = useState<string | null>(null);
  const [remoteOpening, setRemoteOpening] = useState(false);
  const [localOpening, setLocalOpening] = useState(false);
  const [localValidating, setLocalValidating] = useState(false);
  const [folderPickerDialogOpen, setFolderPickerDialogOpen] = useState(false);

  const localPathHint = selectedLocalFolder
    ? `/host/home/.../${selectedLocalFolder}`
    : "/host/home/.../repo, /Users/.../repo, or local .zip path";

  const validateLocalSource = useCallback(async (sourcePath: string): Promise<string> => {
    const validation = await validateRepositorySource(sourcePath);
    if (validation.kind !== "local_git" && validation.kind !== "local_zip") {
      throw new ApiError("Selected source must be a local git repository folder or local .zip path.", 400);
    }
    return validation.resolved_path ?? sourcePath;
  }, []);

  const validateRemoteSource = useCallback(async (sourceUrl: string): Promise<string> => {
    const validation = await validateRepositorySource(sourceUrl);
    if (validation.kind !== "remote_git") {
      throw new ApiError(
        "Remote source must be a git repository URL (example: https://github.com/<owner>/<repo>).",
        400,
      );
    }
    return validation.reference ?? sourceUrl;
  }, []);

  const openRemoteRepository = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!remoteRepoUrl.trim()) {
      toast.error("Enter a repository URL first.");
      return;
    }
    setRemoteOpening(true);
    try {
      const sourceToSave = await validateRemoteSource(remoteRepoUrl.trim());
      const project = await createProject(deriveNameFromRepoUrl(sourceToSave), sourceToSave);
      setRemoteRepoUrl("");
      toast.success(`Repository "${project.name}" added.`);
      await onCreated?.(project);
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
      const sourceToSave = await validateLocalSource(localSourcePath.trim());
      const project = await createProject(deriveNameFromLocalSource(sourceToSave), sourceToSave);
      setLocalSourcePath("");
      setLocalSourceCandidates([]);
      setSelectedLocalFolder(null);
      toast.success(`Repository "${project.name}" added.`);
      await onCreated?.(project);
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

  return (
    <section className={cn("grid gap-4 lg:grid-cols-2", className)}>
      <OpsCard
        chipDotClassName="bg-indigo-500"
        chipLabel="Repository Input"
        description="Connect a public git URL and add it to repository inventory."
        icon={GitBranch}
        title="Open Remote Repository"
        contentClassName=""
      >
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
      </OpsCard>

      <OpsCard
        chipDotClassName="bg-cyan-500"
        chipLabel="Local Source"
        description="Pick a folder or paste a container-visible local path."
        icon={Laptop}
        title="Open Local Repository"
        contentClassName="space-y-3"
      >
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
      </OpsCard>

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
    </section>
  );
}
