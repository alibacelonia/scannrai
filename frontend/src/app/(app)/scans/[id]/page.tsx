"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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

  const [severity, setSeverity] = useState<"" | Severity>("");
  const [tool, setTool] = useState<"" | Tool>("");
  const [category, setCategory] = useState("");
  const [fileQuery, setFileQuery] = useState("");

  const [error, setError] = useState<string | null>(null);

  const fetchScan = useCallback(async () => {
    const data = await getScan(scanId);
    setScan(data);
  }, [scanId]);

  const fetchFindings = useCallback(async () => {
    const data = await listScanFindings(scanId, {
      severity: severity || undefined,
      tool: tool || undefined,
      category: category || undefined,
      file: fileQuery || undefined,
    });
    setFindings(data.results);
  }, [category, fileQuery, scanId, severity, tool]);

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
      void fetchScan();
      void fetchFindings();
    }, 5000);

    return () => clearInterval(timer);
  }, [fetchFindings, fetchScan, scan]);

  const summary = useMemo(() => scan?.summary ?? { critical: 0, high: 0, medium: 0, low: 0, info: 0 }, [scan]);

  const openFinding = async (findingId: number) => {
    try {
      const detail = await getFinding(findingId);
      setSelectedFinding(detail);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      }
    }
  };

  if (!scan) {
    return <p className="text-sm text-[var(--ink-muted)]">Loading scan...</p>;
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
        <CardContent className="grid gap-3 md:grid-cols-5">
          <Metric label="Critical" value={summary.critical} />
          <Metric label="High" value={summary.high} />
          <Metric label="Medium" value={summary.medium} />
          <Metric label="Low" value={summary.low} />
          <Metric label="Info" value={summary.info} />
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
                <TableRow>
                  <TableCell className="text-[var(--ink-muted)]" colSpan={5}>
                    No findings for this filter.
                  </TableCell>
                </TableRow>
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
        <Card>
          <CardHeader>
            <CardTitle>Finding detail #{selectedFinding.id}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto rounded-xl bg-[var(--ink)] p-4 text-xs text-white">
              {JSON.stringify(selectedFinding.raw, null, 2)}
            </pre>
          </CardContent>
        </Card>
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
