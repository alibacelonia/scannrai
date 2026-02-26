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
  title: string;
  description: string;
  file_path: string;
  line_start: number | null;
  line_end: number | null;
  references: Array<{ type: string; value: string }>;
  raw: Record<string, unknown>;
  fingerprint: string;
  ai_explanation?: string | null;
  ai_fix_suggestion?: string | null;
  ai_patch_diff?: string | null;
  confidence?: number | null;
  created_at: string;
  snippet?: {
    start_line: number;
    end_line: number;
    lines: Array<{
      line_number: number;
      content: string;
      highlighted: boolean;
    }>;
  } | null;
}

export interface FindingAiExplainResponse {
  finding_id: number;
  ai_explanation: string;
  ai_fix_suggestion: string;
  confidence: number;
  warning: string;
}

export interface FindingAiPatchResponse {
  finding_id: number;
  ai_patch_diff: string;
  warning: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface UserProfile {
  full_name: string;
  job_title: string;
  bio: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  profile: UserProfile;
  has_completed_profile: boolean;
}

export interface Policy {
  tools_enabled: {
    semgrep: boolean;
    osv: boolean;
    gitleaks: boolean;
  };
  severity_threshold: Severity;
  semgrep_timeout_seconds: number;
  osv_timeout_seconds: number;
  gitleaks_timeout_seconds: number;
  retention_days: number;
  gitleaks_rule_severity_overrides: Record<string, Severity>;
  created_at: string;
  updated_at: string;
}
