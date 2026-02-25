"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ApiError, getFinding, getScan, listScanFindings } from "@/lib/api";
import type { Finding, Scan, Severity, Tool } from "@/types/api";

const severityOptions: Array<"" | Severity> = ["", "critical", "high", "medium", "low", "info"];
const toolOptions: Array<"" | Tool> = ["", "semgrep", "osv", "gitleaks"];

export default function ScanPage() {
  const params = useParams<{ id: string }>();
  const scanId = params.id;

  const [scan, setScan] = useState<Scan | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [detailTab, setDetailTab] = useState<"snippet" | "raw">("snippet");

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
      setSelectedFinding(detail);
      setDetailTab("snippet");
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
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Scan #{scan.id}</span>
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
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--muted)]">
            <div
              className="h-full rounded-full bg-[var(--brand-600)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            <Metric label="Critical" value={summary.critical} />
            <Metric label="High" value={summary.high} />
            <Metric label="Medium" value={summary.medium} />
            <Metric label="Low" value={summary.low} />
            <Metric label="Info" value={summary.info} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Findings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm"
              onChange={(event) => setSeverity(event.target.value as "" | Severity)}
              value={severity}
            >
              {severityOptions.map((value) => (
                <option key={value || "all"} value={value}>
                  {value || "All severities"}
                </option>
              ))}
            </select>
            <select
              className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm"
              onChange={(event) => setTool(event.target.value as "" | Tool)}
              value={tool}
            >
              {toolOptions.map((value) => (
                <option key={value || "all"} value={value}>
                  {value || "All tools"}
                </option>
              ))}
            </select>
            <Input onChange={(event) => setCategory(event.target.value)} placeholder="Category" value={category} />
            <Input onChange={(event) => setFileQuery(event.target.value)} placeholder="File path" value={fileQuery} />
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
                    <TableCell>{finding.file_path || "-"}</TableCell>
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

      {selectedFinding ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 p-2 md:p-6">
          <div className="flex h-full w-full max-w-2xl flex-col rounded-2xl border border-[var(--border)] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
              <p className="font-semibold">Finding #{selectedFinding.id}</p>
              <button
                className="rounded-lg border border-[var(--border)] px-3 py-1 text-sm hover:bg-[var(--muted)]"
                onClick={() => setSelectedFinding(null)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="flex gap-2 border-b border-[var(--border)] px-5 py-3 text-sm">
              <button
                className={`rounded-lg px-3 py-1 ${detailTab === "snippet" ? "bg-[var(--brand-100)] text-[var(--brand-700)]" : "bg-[var(--muted)]"}`}
                onClick={() => setDetailTab("snippet")}
                type="button"
              >
                Code Snippet
              </button>
              <button
                className={`rounded-lg px-3 py-1 ${detailTab === "raw" ? "bg-[var(--brand-100)] text-[var(--brand-700)]" : "bg-[var(--muted)]"}`}
                onClick={() => setDetailTab("raw")}
                type="button"
              >
                Raw JSON
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {detailTab === "snippet" ? (
                selectedFinding.snippet?.lines?.length ? (
                  <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[#0f172a] text-xs text-slate-100">
                    {selectedFinding.snippet.lines.map((line) => (
                      <div
                        className={`grid grid-cols-[56px_1fr] px-3 py-1 ${line.highlighted ? "bg-[#1e293b]" : ""}`}
                        key={line.line_number}
                      >
                        <span className="text-slate-400">{line.line_number}</span>
                        <code className="whitespace-pre-wrap">{line.content || " "}</code>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--ink-muted)]">No snippet available for this finding.</p>
                )
              ) : (
                <pre className="overflow-auto rounded-xl bg-[var(--ink)] p-4 text-xs text-white">
                  {JSON.stringify(selectedFinding.raw, null, 2)}
                </pre>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-[var(--ink-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ScanSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-40 rounded-2xl border border-[var(--border)] bg-[var(--muted)]" />
      <div className="h-96 rounded-2xl border border-[var(--border)] bg-[var(--muted)]" />
    </div>
  );
}

function FindingSkeletonRows() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, idx) => (
        <TableRow key={`skeleton-${idx}`}>
          <TableCell colSpan={5}>
            <div className="h-4 w-full animate-pulse rounded bg-[var(--muted)]" />
          </TableCell>
        </TableRow>
      ))}
    </>
  );
}
