import { clearTokens, getAccessToken, getRefreshToken, saveTokens } from "@/lib/auth";
import type {
  Finding,
  FindingAiExplainResponse,
  FindingAiPatchResponse,
  Paginated,
  Policy,
  Project,
  Scan,
  TokenPair,
  User,
} from "@/types/api";

function hasScheme(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value);
}

function isLocalHostLike(value: string): boolean {
  return /^(localhost|127(?:\.\d{1,3}){3})(:\d+)?$/i.test(value);
}

function normalizeApiBaseUrl(value: string | undefined): string {
  const fallback = "http://localhost:8000";
  const raw = String(value ?? "").trim();
  if (!raw) {
    return fallback;
  }

  const withoutTrailingSlash = raw.replace(/\/+$/, "");
  const withScheme = hasScheme(withoutTrailingSlash)
    ? withoutTrailingSlash
    : `${isLocalHostLike(withoutTrailingSlash) ? "http" : "https"}://${withoutTrailingSlash}`;

  try {
    const parsed = new URL(withScheme);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return fallback;
  }
}

function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return new URL(normalizedPath, `${API_BASE_URL}/`).toString();
}

function summarizeTextBody(text: string, status: number): string | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }

  if (/<(!doctype|html)\b/i.test(trimmed)) {
    if (status === 404) {
      return "Received HTML 404 instead of API JSON. Verify NEXT_PUBLIC_API_BASE_URL points to the backend origin.";
    }
    return "Received unexpected HTML response from API. Verify NEXT_PUBLIC_API_BASE_URL and reverse-proxy routing.";
  }

  return trimmed.length > 280 ? `${trimmed.slice(0, 280)}...` : trimmed;
}

function shrinkErrorDetails(body: unknown): unknown {
  if (typeof body !== "string") {
    return body;
  }
  const maxChars = 1200;
  return body.length > maxChars ? `${body.slice(0, maxChars)}...` : body;
}

const API_BASE_URL = normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
let refreshPromise: Promise<string | null> | null = null;

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

function firstErrorMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (Array.isArray(value) && value.length > 0) {
    return firstErrorMessage(value[0]);
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, nested] of Object.entries(value)) {
      const childMessage = firstErrorMessage(nested);
      if (childMessage) {
        return `${key}: ${childMessage}`;
      }
    }
  }
  return null;
}

async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  options: { auth?: boolean } = { auth: true },
): Promise<T> {
  const execute = async (token: string | null) => {
    const headers = new Headers(init.headers ?? {});
    if (options.auth && token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return fetch(buildApiUrl(path), {
      ...init,
      headers,
    });
  };

  let response: Response;
  try {
    response = await execute(getAccessToken());
    if (options.auth && response.status === 401) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        response = await execute(refreshedToken);
      }
    }
  } catch (error) {
    throw new ApiError(
      `Cannot reach API at ${API_BASE_URL}. Check backend availability, TLS, and CORS configuration.`,
      0,
      error,
    );
  }

  const rawBody = await response.text();
  let body: unknown = null;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = rawBody;
      }
    }
  } else {
    body = rawBody;
  }

  if (!response.ok) {
    if (options.auth && response.status === 401) {
      clearTokens();
    }
    const messageFromDetail =
      typeof body === "object" && body !== null && "detail" in body
        ? String((body as { detail?: string }).detail)
        : null;
    const messageFromText = typeof body === "string" ? summarizeTextBody(body, response.status) : null;
    const message =
      messageFromDetail || messageFromText || firstErrorMessage(body) || response.statusText || "Request failed";
    throw new ApiError(message, response.status, shrinkErrorDetails(body));
  }

  return body as T;
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return null;
  }

  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch(buildApiUrl("/api/auth/token/refresh/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (!response.ok) {
        clearTokens();
        return null;
      }
      const payload = (await response.json()) as { access?: string; refresh?: string };
      if (!payload.access) {
        clearTokens();
        return null;
      }
      saveTokens({ access: payload.access, refresh: payload.refresh ?? refreshToken });
      return payload.access;
    } catch {
      clearTokens();
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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

export async function updateMeProfile(payload: {
  full_name?: string;
  job_title?: string;
  bio?: string;
}): Promise<User> {
  return apiRequest<User>("/api/me/", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ detail: string }> {
  return apiRequest<{ detail: string }>("/api/auth/change-password/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
}

export async function listProjects(): Promise<Paginated<Project>> {
  return apiRequest<Paginated<Project>>("/api/projects/");
}

export async function createProject(name: string, source: string): Promise<Project> {
  return apiRequest<Project>("/api/projects/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, repo_url: source || null }),
  });
}

export async function validateRepositorySource(source: string): Promise<{
  valid: boolean;
  kind: string;
  resolved_path?: string;
  reference?: string;
}> {
  return apiRequest<{
    valid: boolean;
    kind: string;
    resolved_path?: string;
    reference?: string;
  }>("/api/projects/validate-source/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source }),
  });
}

export async function discoverRepositorySource(
  folderName: string,
): Promise<{ folder_name: string; candidates: string[] }> {
  return apiRequest<{ folder_name: string; candidates: string[] }>("/api/projects/discover-source/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folder_name: folderName }),
  });
}

export async function getProject(projectId: string): Promise<Project> {
  return apiRequest<Project>(`/api/projects/${projectId}/`);
}

export async function listProjectScans(projectId: string): Promise<Paginated<Scan>> {
  return apiRequest<Paginated<Scan>>(`/api/projects/${projectId}/scans/`);
}

export async function createScan(projectId: string): Promise<Scan> {
  return apiRequest<Scan>(`/api/projects/${projectId}/scans/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meta: { trigger: "ui-queue" } }),
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

export async function aiExplainFinding(findingId: number): Promise<FindingAiExplainResponse> {
  return apiRequest<FindingAiExplainResponse>(`/api/findings/${findingId}/ai/explain/`, {
    method: "POST",
  });
}

export async function aiPatchFinding(findingId: number): Promise<FindingAiPatchResponse> {
  return apiRequest<FindingAiPatchResponse>(`/api/findings/${findingId}/ai/patch/`, {
    method: "POST",
  });
}

export async function exportScanJson(scanId: string): Promise<Blob> {
  const response = await apiRequestBlob(`/api/scans/${scanId}/export.json/`);
  if (!response.ok) {
    throw new ApiError("Unable to export JSON report.", response.status);
  }
  return response.blob();
}

export async function exportScanMarkdown(scanId: string): Promise<Blob> {
  const response = await apiRequestBlob(`/api/scans/${scanId}/export.md/`);
  if (!response.ok) {
    throw new ApiError("Unable to export Markdown report.", response.status);
  }
  return response.blob();
}

async function apiRequestBlob(path: string): Promise<Response> {
  const execute = async (token: string | null) =>
    fetch(`${API_BASE_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

  let response = await execute(getAccessToken());
  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      response = await execute(refreshedToken);
    }
  }
  if (response.status === 401) {
    clearTokens();
  }
  return response;
}

export async function getPolicy(): Promise<Policy> {
  return apiRequest<Policy>("/api/policy");
}

export async function updatePolicy(policy: Omit<Policy, "created_at" | "updated_at">): Promise<Policy> {
  return apiRequest<Policy>("/api/policy", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(policy),
  });
}

export { ApiError };
