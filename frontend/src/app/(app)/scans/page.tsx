"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, listProjects, listProjectScans } from "@/lib/api";
import type { Scan } from "@/types/api";

type ScanRow = {
  scan: Scan;
  projectId: number;
  projectName: string;
};

function formatUtcTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

export default function ScansPage() {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projectFilter, setProjectFilter] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const projectPage = await listProjects();
      const scanRows: ScanRow[] = [];
      const scansByProject = await Promise.all(
        projectPage.results.map(async (project) => {
          const scansPage = await listProjectScans(String(project.id));
          return { project, scans: scansPage.results };
        }),
      );
      for (const entry of scansByProject) {
        for (const scan of entry.scans) {
          scanRows.push({ scan, projectId: entry.project.id, projectName: entry.project.name });
        }
      }
      scanRows.sort((a, b) => new Date(b.scan.created_at).getTime() - new Date(a.scan.created_at).getTime());
      setRows(scanRows);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load scans.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    const query = projectFilter.trim().toLowerCase();
    if (!query) {
      return rows;
    }
    return rows.filter((row) => row.projectName.toLowerCase().includes(query) || String(row.projectId).includes(query));
  }, [projectFilter, rows]);

  if (loading) {
    return <ScansSkeleton />;
  }

  return (
    <PageShell eyebrow="Scans" title="All Scans" description="Track scan status across all repositories.">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>Scan History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Filter by repository</label>
            <Input onChange={(event) => setProjectFilter(event.target.value)} placeholder="Project name or id" value={projectFilter} />
          </div>
          {filteredRows.length === 0 ? <p className="text-xs text-slate-500">No scans found.</p> : null}
          <div className="space-y-2">
            {filteredRows.map((row) => (
              <Link
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-3 hover:bg-slate-100"
                href={`/scans/${row.scan.id}`}
                key={row.scan.id}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-900">Scan #{row.scan.id}</p>
                  <p className="mt-1 text-[11px] text-slate-500">
                    {row.projectName} (#{row.projectId}) • {formatUtcTimestamp(row.scan.created_at)}
                  </p>
                </div>
                <Badge
                  variant={
                    row.scan.status === "completed"
                      ? "success"
                      : row.scan.status === "failed"
                        ? "danger"
                        : row.scan.status === "running"
                          ? "warning"
                          : "default"
                  }
                >
                  {row.scan.status}
                </Badge>
              </Link>
            ))}
          </div>
          {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
        </CardContent>
      </Card>
    </PageShell>
  );
}

function ScansSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-7 w-32" />
        <Skeleton className="mt-2 h-4 w-56 max-w-full" />
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton className="h-14 w-full" key={`scan-row-${idx}`} />
        ))}
      </div>
    </div>
  );
}
