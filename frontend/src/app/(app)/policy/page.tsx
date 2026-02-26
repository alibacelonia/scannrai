"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getPolicy, updatePolicy } from "@/lib/api";
import type { Policy, Severity } from "@/types/api";

const severityOptions: Severity[] = ["critical", "high", "medium", "low", "info"];

type EditablePolicy = Omit<Policy, "created_at" | "updated_at">;

function parseInteger(value: string, fallback = 0): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

export default function PolicyPage() {
  const [policy, setPolicy] = useState<EditablePolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const loadPolicy = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPolicy();
      setPolicy({
        tools_enabled: data.tools_enabled,
        severity_threshold: data.severity_threshold,
        semgrep_timeout_seconds: data.semgrep_timeout_seconds,
        osv_timeout_seconds: data.osv_timeout_seconds,
        gitleaks_timeout_seconds: data.gitleaks_timeout_seconds,
        retention_days: data.retention_days,
        gitleaks_rule_severity_overrides: data.gitleaks_rule_severity_overrides,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to load policy.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPolicy();
  }, [loadPolicy]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!policy) {
      return;
    }
    setSaving(true);
    setSavedMessage(null);
    setError(null);
    try {
      await updatePolicy(policy);
      setSavedMessage("Policy saved.");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to save policy.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading || !policy) {
    return <PolicySkeleton />;
  }

  return (
    <PageShell eyebrow="Policy" title="Scan Policy" description="Configure enabled scanners, thresholds, and timeouts.">
      <form onSubmit={save}>
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Policy Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Enabled tools</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <input
                    checked={policy.tools_enabled.semgrep}
                    onChange={(event) =>
                      setPolicy((current) =>
                        current
                          ? {
                              ...current,
                              tools_enabled: { ...current.tools_enabled, semgrep: event.target.checked },
                            }
                          : current,
                      )
                    }
                    type="checkbox"
                  />
                  Semgrep
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <input
                    checked={policy.tools_enabled.osv}
                    onChange={(event) =>
                      setPolicy((current) =>
                        current
                          ? {
                              ...current,
                              tools_enabled: { ...current.tools_enabled, osv: event.target.checked },
                            }
                          : current,
                      )
                    }
                    type="checkbox"
                  />
                  OSV
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                  <input
                    checked={policy.tools_enabled.gitleaks}
                    onChange={(event) =>
                      setPolicy((current) =>
                        current
                          ? {
                              ...current,
                              tools_enabled: { ...current.tools_enabled, gitleaks: event.target.checked },
                            }
                          : current,
                      )
                    }
                    type="checkbox"
                  />
                  Gitleaks
                </label>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Severity threshold</p>
                <Select
                  onValueChange={(value) =>
                    setPolicy((current) => (current ? { ...current, severity_threshold: value as Severity } : current))
                  }
                  value={policy.severity_threshold}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {severityOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Retention days</p>
                <Input
                  min={1}
                  onChange={(event) =>
                    setPolicy((current) => (current ? { ...current, retention_days: parseInteger(event.target.value, 1) } : current))
                  }
                  type="number"
                  value={policy.retention_days}
                />
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Semgrep timeout (s)</p>
                <Input
                  min={30}
                  onChange={(event) =>
                    setPolicy((current) =>
                      current ? { ...current, semgrep_timeout_seconds: parseInteger(event.target.value, 30) } : current,
                    )
                  }
                  type="number"
                  value={policy.semgrep_timeout_seconds}
                />
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">OSV timeout (s)</p>
                <Input
                  min={30}
                  onChange={(event) =>
                    setPolicy((current) =>
                      current ? { ...current, osv_timeout_seconds: parseInteger(event.target.value, 30) } : current,
                    )
                  }
                  type="number"
                  value={policy.osv_timeout_seconds}
                />
              </div>

              <div className="space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Gitleaks timeout (s)</p>
                <Input
                  min={30}
                  onChange={(event) =>
                    setPolicy((current) =>
                      current ? { ...current, gitleaks_timeout_seconds: parseInteger(event.target.value, 30) } : current,
                    )
                  }
                  type="number"
                  value={policy.gitleaks_timeout_seconds}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button disabled={saving} type="submit">
                {saving ? "Saving..." : "Save policy"}
              </Button>
              {savedMessage ? <p className="text-xs font-medium text-emerald-700">{savedMessage}</p> : null}
            </div>
            {error ? <p className="text-xs font-medium text-red-700">{error}</p> : null}
          </CardContent>
        </Card>
      </form>
    </PageShell>
  );
}

function PolicySkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-7 w-36" />
        <Skeleton className="mt-2 h-4 w-60 max-w-full" />
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
