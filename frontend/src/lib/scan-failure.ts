import type { Scan } from "@/types/api";

const TOOL_LABELS: Record<string, string> = {
  semgrep: "Semgrep",
  osv: "OSV Scanner",
  gitleaks: "Gitleaks",
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function getScanFailureCause(scan: Scan | null | undefined): string | null {
  if (!scan || scan.status !== "failed") {
    return null;
  }

  const meta = asRecord(scan.meta) ?? {};
  const directCause =
    asString(meta.ingestion_error) ??
    asString(meta.queue_error) ??
    asString(asRecord(meta.stale_recovery)?.reason);
  if (directCause) {
    return directCause;
  }

  const toolRuns = asRecord(meta.tool_runs);
  if (!toolRuns) {
    return "Scan failed. No error details were recorded.";
  }

  for (const [toolName, run] of Object.entries(toolRuns)) {
    const runRecord = asRecord(run);
    if (!runRecord || runRecord.skipped === true) {
      continue;
    }

    const errorMessage = asString(runRecord.error) ?? asString(runRecord.stderr);
    if (!errorMessage) {
      continue;
    }

    const label = TOOL_LABELS[toolName] ?? toolName;
    return `${label}: ${errorMessage}`;
  }

  return "Scan failed. No error details were recorded.";
}
