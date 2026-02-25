import { clearTokens, getAccessToken } from "@/lib/auth";
import type { Finding, Paginated, Project, Scan, TokenPair, User } from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = { auth: true },
): Promise<T> {
  const headers = new Headers(init.headers ?? {});
  const token = getAccessToken();

  if (options.auth && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  let body: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearTokens();
    }
    const message =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail?: string }).detail)
        : response.statusText || "Request failed";
    throw new ApiError(message, response.status, body);
  }

  return body as T;
}

export async function login(username: string, password: string): Promise<TokenPair> {
  return apiRequest<TokenPair>(
    "/api/auth/token/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    },
    { auth: false },
  );
}

export async function register(username: string, email: string, password: string): Promise<User> {
  return apiRequest<User>(
    "/api/auth/register/",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    },
    { auth: false },
  );
}

export async function getMe(): Promise<User> {
  return apiRequest<User>("/api/me/");
}

export async function listProjects(): Promise<Paginated<Project>> {
  return apiRequest<Paginated<Project>>("/api/projects/");
}

export async function createProject(name: string, repoUrl: string): Promise<Project> {
  return apiRequest<Project>("/api/projects/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, repo_url: repoUrl || null }),
  });
}

export async function getProject(projectId: string): Promise<Project> {
  return apiRequest<Project>(`/api/projects/${projectId}/`);
}

export async function listProjectScans(projectId: string): Promise<Paginated<Scan>> {
  return apiRequest<Paginated<Scan>>(`/api/projects/${projectId}/scans/`);
}

export async function createScan(projectId: string, payload: { zipFile?: File | null } = {}): Promise<Scan> {
  if (payload.zipFile) {
    const form = new FormData();
    form.append("zip_file", payload.zipFile);
    form.append("meta", JSON.stringify({ trigger: "ui-upload" }));
    return apiRequest<Scan>(`/api/projects/${projectId}/scans/`, {
      method: "POST",
      body: form,
    });
  }

  return apiRequest<Scan>(`/api/projects/${projectId}/scans/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meta: { trigger: "ui" } }),
  });
}

export async function getScan(scanId: string): Promise<Scan> {
  return apiRequest<Scan>(`/api/scans/${scanId}/`);
}

export async function listScanFindings(
  scanId: string,
  filters: { severity?: string; tool?: string; category?: string; file?: string } = {},
): Promise<Paginated<Finding>> {
  const query = new URLSearchParams();
  if (filters.severity) query.set("severity", filters.severity);
  if (filters.tool) query.set("tool", filters.tool);
  if (filters.category) query.set("category", filters.category);
  if (filters.file) query.set("file", filters.file);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<Paginated<Finding>>(`/api/scans/${scanId}/findings/${suffix}`);
}

export async function getFinding(findingId: number): Promise<Finding> {
  return apiRequest<Finding>(`/api/findings/${findingId}/`);
}

export async function exportScanJson(scanId: string): Promise<Blob> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/scans/${scanId}/export.json/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new ApiError("Unable to export JSON report.", response.status);
  }
  return response.blob();
}

export async function exportScanMarkdown(scanId: string): Promise<Blob> {
  const token = getAccessToken();
  const response = await fetch(`${API_BASE_URL}/api/scans/${scanId}/export.md/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    throw new ApiError("Unable to export Markdown report.", response.status);
  }
  return response.blob();
}

export { ApiError };
