"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, FileCode2, Sparkles } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  aiExplainFinding,
  aiPatchFinding,
  ApiError,
  exportScanJson,
  exportScanMarkdown,
  getFinding,
  getScan,
  listScanFindings,
} from "@/lib/api";
import type { Finding, Scan, Severity, Tool } from "@/types/api";

const severityOptions: Array<"all" | Severity> = ["all", "critical", "high", "medium", "low", "info"];
const toolOptions: Array<"all" | Tool> = ["all", "semgrep", "osv", "gitleaks"];

export default function ScanPage() {
  const params = useParams<{ id: string }>();
  const scanId = params.id;

  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [detailTab, setDetailTab] = useState<"snippet" | "suggestion" | "patch" | "raw">("snippet");
  const [aiExplainLoading, setAiExplainLoading] = useState(false);
  const [aiPatchLoading, setAiPatchLoading] = useState(false);
  const [aiWarning, setAiWarning] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [severity, setSeverity] = useState<"" | Severity>("");
  const [tool, setTool] = useState<"" | Tool>("");
  const [category, setCategory] = useState("");
  const [fileQuery, setFileQuery] = useState("");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const data = await getScan(scanId);
        if (mounted) {
          setScan(data);
        }
      } catch (err) {
        if (mounted) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("Unable to load scan.");
          }
        }
      }
    };
    void run();

    return () => {
      mounted = false;
    };
  }, [scanId]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      try {
        const data = await listScanFindings(scanId, {
          severity: severity || undefined,
          tool: tool || undefined,
          category: category || undefined,
          file: fileQuery || undefined,
        });
        if (mounted) {
          setFindings(data.results);
        }
      } catch (err) {
        if (mounted) {
          if (err instanceof ApiError) {
            setError(err.message);
          } else {
            setError("Unable to load findings.");
          }
        }
      }
    };
    void run();

    return () => {
      mounted = false;
    };
  }, [category, fileQuery, scanId, severity, tool]);

  useEffect(() => {
    if (!scan || (scan.status !== "queued" && scan.status !== "running")) {
      return;
    }

    const timer = setInterval(() => {
      void getScan(scanId).then(setScan).catch(() => undefined);
      void listScanFindings(scanId, {
        severity: severity || undefined,
        tool: tool || undefined,
        category: category || undefined,
        file: fileQuery || undefined,
      })
        .then((data) => setFindings(data.results))
        .catch(() => undefined);
    }, 5000);

    return () => clearInterval(timer);
  }, [category, fileQuery, scan, scanId, severity, tool]);

  const summary = useMemo(() => scan?.summary ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, [scan]);

  const progress = useMemo(() => {
    if (!scan) return 5;
    if (scan.status === "queued") return 25;
    if (scan.status === "running") return 65;
    return 100;
  }, [scan]);

  const openFinding = async (findingId: number) => {
    try {
      const detail = await getFinding(findingId);
      setAiWarning(null);
      setDetailError(null);
      setAiExplainLoading(false);
      setAiPatchLoading(false);
      setSelectedFinding(detail);
      if (detail.ai_explanation || detail.ai_fix_suggestion) {
        setDetailTab("suggestion");
      } else if (detail.ai_patch_diff) {
        setDetailTab("patch");
      } else {
        setDetailTab("snippet");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  };

  const generateAiSuggestion = async () => {
    if (!selectedFinding) {
      return;
    }
    setDetailError(null);
    setAiExplainLoading(true);
    try {
      const response = await aiExplainFinding(selectedFinding.id);
      setSelectedFinding((current) =>
        current && current.id === response.finding_id
          ? {
              ...current,
              ai_explanation: response.ai_explanation,
              ai_fix_suggestion: response.ai_fix_suggestion,
              confidence: response.confidence,
            }
          : current,
      );
      setAiWarning(response.warning || null);
      setDetailTab("suggestion");
    } catch (err) {
      if (err instanceof ApiError) {
        setDetailError(err.message);
      } else {
        setDetailError("Unable to generate AI suggestion.");
      }
    } finally {
      setAiExplainLoading(false);
    }
  };

  const generateAiPatch = async () => {
    if (!selectedFinding) {
      return;
    }
    setDetailError(null);
    setAiPatchLoading(true);
    try {
      const response = await aiPatchFinding(selectedFinding.id);
      setSelectedFinding((current) =>
        current && current.id === response.finding_id
          ? {
              ...current,
              ai_patch_diff: response.ai_patch_diff,
            }
          : current,
      );
      setAiWarning(response.warning || null);
      setDetailTab("patch");
    } catch (err) {
      if (err instanceof ApiError) {
        setDetailError(err.message);
      } else {
        setDetailError("Unable to generate AI patch.");
      }
    } finally {
      setAiPatchLoading(false);
    }
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadJson = async () => {
    try {
      const blob = await exportScanJson(scanId);
      downloadBlob(blob, `scan-${scanId}.json`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  };

  const downloadMarkdown = async () => {
    try {
      const blob = await exportScanMarkdown(scanId);
      downloadBlob(blob, `scan-${scanId}.md`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  };

  if (!scan) {
    return <ScanSkeleton />;
  }

  return (
    <PageShell
      eyebrow="Scan Session"
      title={`Scan #${scan.id}`}
      description="Monitor execution and inspect normalized findings."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={scan.status} />
          <Button onClick={downloadJson} size="sm" variant="outline">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            JSON
          </Button>
          <Button onClick={downloadMarkdown} size="sm" variant="outline">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Markdown
          </Button>
        </div>
      }
    >
      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Run progress</CardTitle>
            <CardDescription>Auto-refreshes while the scan is queued or running.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
              <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${progress}%` }} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Metric label="Critical" value={summary.critical} tone="critical" />
              <Metric label="High" value={summary.high} tone="high" />
              <Metric label="Medium" value={summary.medium} tone="medium" />
              <Metric label="Low" value={summary.low} tone="low" />
              <Metric label="Info" value={summary.info} tone="info" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Findings</CardTitle>
            <CardDescription>Click a row to inspect evidence and generate AI remediation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Severity</p>
                <Select onValueChange={(value) => setSeverity(value === "all" ? "" : (value as Severity))} value={severity || "all"}>
                  <SelectTrigger>
                    <SelectValue placeholder="All severities" />
                  </SelectTrigger>
                  <SelectContent>
                    {severityOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value === "all" ? "All severities" : value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Tool</p>
                <Select onValueChange={(value) => setTool(value === "all" ? "" : (value as Tool))} value={tool || "all"}>
                  <SelectTrigger>
                    <SelectValue placeholder="All tools" />
                  </SelectTrigger>
                  <SelectContent>
                    {toolOptions.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value === "all" ? "All tools" : value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Category</p>
                <Input onChange={(event) => setCategory(event.target.value)} placeholder="Filter category" value={category} />
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">File path</p>
                <Input onChange={(event) => setFileQuery(event.target.value)} placeholder="Filter file" value={fileQuery} />
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Lines</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {findings.length === 0 ? (
                  scan.status === "running" || scan.status === "queued" ? (
                    <FindingSkeletonRows />
                  ) : (
                    <TableRow>
                      <TableCell className="text-[var(--ink-muted)]" colSpan={5}>
                        No findings for this filter.
                      </TableCell>
                    </TableRow>
                  )
                ) : (
                  findings.map((finding) => (
                    <TableRow
                      className="cursor-pointer"
                      key={finding.id}
                      onClick={() => {
                        void openFinding(finding.id);
                      }}
                    >
                      <TableCell>
                        <Badge variant={finding.severity}>{finding.severity}</Badge>
                      </TableCell>
                      <TableCell>{finding.tool}</TableCell>
                      <TableCell>{finding.category}</TableCell>
                      <TableCell className="max-w-[360px] truncate">{finding.file_path || "-"}</TableCell>
                      <TableCell>
                        {finding.line_start ? `${finding.line_start}${finding.line_end ? `-${finding.line_end}` : ""}` : "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <Dialog
        open={Boolean(selectedFinding)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedFinding(null);
            setAiWarning(null);
            setDetailError(null);
            setAiExplainLoading(false);
            setAiPatchLoading(false);
          }
        }}
      >
        {selectedFinding ? (
          <DialogContent className="flex h-[90vh] max-w-4xl flex-col overflow-hidden p-0">
            <DialogHeader className="border-b border-[var(--border)] pb-4">
              <DialogTitle className="flex items-center gap-2 text-base">
                <FileCode2 className="h-4 w-4" />
                Finding #{selectedFinding.id}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Review scanner evidence, then generate AI suggestion or patch for faster remediation.
              </DialogDescription>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button disabled={aiExplainLoading} onClick={() => void generateAiSuggestion()} size="sm">
                  <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                  {aiExplainLoading ? "Generating suggestion..." : selectedFinding.ai_fix_suggestion ? "Regenerate suggestion" : "Generate suggestion"}
                </Button>
                <Button disabled={aiPatchLoading} onClick={() => void generateAiPatch()} size="sm" variant="outline">
                  {aiPatchLoading ? "Generating patch..." : selectedFinding.ai_patch_diff ? "Regenerate patch" : "Generate patch"}
                </Button>
              </div>
            </DialogHeader>
            <div className="flex-1 overflow-hidden p-4">
              <Tabs
                className="flex h-full flex-col"
                onValueChange={(value) => setDetailTab(value as "snippet" | "suggestion" | "patch" | "raw")}
                value={detailTab}
              >
                <TabsList>
                  <TabsTrigger value="snippet">Code snippet</TabsTrigger>
                  <TabsTrigger value="suggestion">AI suggestion</TabsTrigger>
                  <TabsTrigger value="patch">AI patch</TabsTrigger>
                  <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                </TabsList>
                <TabsContent className="h-full overflow-auto" value="snippet">
                  {selectedFinding.snippet?.lines?.length ? (
                    <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-xs text-slate-100">
                      {selectedFinding.snippet.lines.map((line) => (
                        <div
                          className={`grid grid-cols-[56px_1fr] px-3 py-1 ${line.highlighted ? "bg-slate-800" : ""}`}
                          key={line.line_number}
                        >
                          <span className="text-slate-400">{line.line_number}</span>
                          <code className="whitespace-pre-wrap">{line.content || " "}</code>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--ink-muted)]">No snippet available for this finding.</p>
                  )}
                </TabsContent>
                <TabsContent className="h-full overflow-auto" value="suggestion">
                  {selectedFinding.ai_explanation || selectedFinding.ai_fix_suggestion ? (
                    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-4">
                      {selectedFinding.confidence !== null && selectedFinding.confidence !== undefined ? (
                        <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">
                          Confidence: {Math.round(selectedFinding.confidence * 100)}%
                        </p>
                      ) : null}
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Explanation</p>
                        <p className="whitespace-pre-wrap text-sm text-[var(--ink)]">
                          {selectedFinding.ai_explanation || "No explanation generated yet."}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Suggested fix</p>
                        <pre className="overflow-auto rounded-lg border border-[var(--border)] bg-white p-3 text-xs text-[var(--ink)]">
                          {selectedFinding.ai_fix_suggestion || "No fix suggestion generated yet."}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--ink-muted)]">
                      No AI suggestion generated yet. Click &quot;Generate suggestion&quot; to create one.
                    </p>
                  )}
                </TabsContent>
                <TabsContent className="h-full overflow-auto" value="patch">
                  {selectedFinding.ai_patch_diff ? (
                    <div className="overflow-auto rounded-xl border border-slate-800 bg-slate-950 p-2 font-mono text-xs">
                      {selectedFinding.ai_patch_diff.split("\n").map((line, idx) => (
                        <div className={`px-2 py-0.5 ${patchLineClassName(line)}`} key={`${idx}-${line.slice(0, 16)}`}>
                          <span className="whitespace-pre-wrap break-words">{line || " "}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--ink-muted)]">
                      No AI patch generated yet. Click &quot;Generate patch&quot; to create a proposed diff.
                    </p>
                  )}
                </TabsContent>
                <TabsContent className="h-full overflow-auto" value="raw">
                  <pre className="overflow-auto rounded-xl bg-slate-900 p-4 text-xs text-white">
                    {JSON.stringify(selectedFinding.raw, null, 2)}
                  </pre>
                </TabsContent>
              </Tabs>
              {aiWarning ? (
                <p className="mt-3 inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {aiWarning}
                </p>
              ) : null}
              {detailError ? <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{detailError}</p> : null}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p> : null}
    </PageShell>
  );
}

function StatusBadge({ status }: { status: Scan["status"] }) {
  return (
    <Badge
      variant={
        status === "completed"
          ? "success"
          : status === "failed"
            ? "danger"
            : status === "running"
              ? "warning"
              : "default"
      }
    >
      {status}
    </Badge>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "critical" | "high" | "medium" | "low" | "info";
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">{label}</p>
        <Badge variant={tone}>{tone}</Badge>
      </div>
      <p className="mt-2 text-lg font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function patchLineClassName(line: string) {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return "bg-emerald-950/40 text-emerald-300";
  }
  if (line.startsWith("-") && !line.startsWith("---")) {
    return "bg-red-950/40 text-red-300";
  }
  if (line.startsWith("@@")) {
    return "bg-sky-950/40 text-sky-300";
  }
  if (line.startsWith("diff ") || line.startsWith("index ") || line.startsWith("+++ ") || line.startsWith("--- ")) {
    return "bg-slate-900 text-amber-200";
  }
  return "text-slate-200";
}

function ScanSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-7 w-40" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>
      <div className="space-y-4">
        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-3" key={`metric-${idx}`}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-6 w-10" />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-4">
          <Skeleton className="h-3 w-20" />
          <div className="grid gap-3 md:grid-cols-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}

function FindingSkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, idx) => (
        <TableRow key={`skeleton-${idx}`}>
          <TableCell colSpan={5}>
            <Skeleton className="h-4 w-full" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
