export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Tool = "semgrep" | "osv" | "gitleaks";

export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Project {
  id: number;
  name: string;
  repo_url: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface Scan {
  id: number;
  project: number;
  status: "queued" | "running" | "completed" | "failed";
  commit_hash: string | null;
  started_at: string | null;
  finished_at: string | null;
  meta: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  summary: Record<Severity, number>;
}

export interface Finding {
  id: number;
  scan: number;
  tool: Tool;
  severity: Severity;
  category: string;
  file_path: string;
  line_start: number | null;
  line_end: number | null;
  raw: Record<string, unknown>;
  fingerprint: string;
  created_at: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
}
