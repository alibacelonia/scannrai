"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { CircleHelp, ShieldCheck, TimerReset } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { OpsCard, OpsMetricCard, OpsPanel } from "@/components/ui/ops-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
    <PageShell eyebrow="Policy" title="Scan Guardrails" description="Set tool enablement, timeouts, and severity gates.">
      <form className="space-y-4" onSubmit={save}>
        <section className="grid gap-4 md:grid-cols-3">
          <PolicyInfo title="Severity threshold" value={policy.severity_threshold} icon={ShieldCheck} />
          <PolicyInfo title="Retention" value={`${policy.retention_days} days`} icon={TimerReset} />
          <PolicyInfo title="Tools enabled" value={`${Object.values(policy.tools_enabled).filter(Boolean).length}/3`} icon={ShieldCheck} />
        </section>

        <OpsCard
          chipDotClassName="bg-emerald-500"
          chipLabel="Tool Controls"
          description="Enable or disable scanning adapters per tenant policy."
          icon={ShieldCheck}
          title="Tooling"
          contentClassName=""
        >
            <div className="grid gap-2 sm:grid-cols-3">
              <PolicyToggle
                checked={policy.tools_enabled.semgrep}
                description="Semgrep performs static code analysis to detect security issues and risky patterns directly in source code."
                label="Semgrep"
                onCheckedChange={(checked) =>
                  setPolicy((current) =>
                    current
                      ? {
                          ...current,
                          tools_enabled: { ...current.tools_enabled, semgrep: checked },
                        }
                      : current,
                  )
                }
              />
              <PolicyToggle
                checked={policy.tools_enabled.osv}
                description="OSV checks dependencies and lockfiles for known vulnerabilities from the OSV vulnerability database."
                label="OSV"
                onCheckedChange={(checked) =>
                  setPolicy((current) =>
                    current
                      ? {
                          ...current,
                          tools_enabled: { ...current.tools_enabled, osv: checked },
                        }
                      : current,
                  )
                }
              />
              <PolicyToggle
                checked={policy.tools_enabled.gitleaks}
                description="Gitleaks detects accidentally committed secrets such as API keys, tokens, and credentials."
                label="Gitleaks"
                onCheckedChange={(checked) =>
                  setPolicy((current) =>
                    current
                      ? {
                          ...current,
                          tools_enabled: { ...current.tools_enabled, gitleaks: checked },
                        }
                      : current,
                  )
                }
              />
            </div>
        </OpsCard>

        <OpsCard
          chipDotClassName="bg-sky-500"
          chipLabel="Execution Limits"
          description="Tune scanner execution windows and result retention."
          icon={TimerReset}
          title="Thresholds and timeouts"
          contentClassName="grid gap-3 md:grid-cols-2"
        >
            <OpsPanel className="space-y-1">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Severity threshold</p>
                <InfoPopover
                  description="Defines the minimum severity level to emphasize when reviewing scan results and policy decisions."
                  title="Severity threshold"
                />
              </div>
              <Select
                onValueChange={(value) => setPolicy((current) => (current ? { ...current, severity_threshold: value as Severity } : current))}
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
            </OpsPanel>

            <OpsPanel className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Retention days</p>
              <Input
                min={1}
                onChange={(event) =>
                  setPolicy((current) => (current ? { ...current, retention_days: parseInteger(event.target.value, 1) } : current))
                }
                type="number"
                value={policy.retention_days}
              />
            </OpsPanel>

            <OpsPanel className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Semgrep timeout (s)</p>
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
            </OpsPanel>

            <OpsPanel className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">OSV timeout (s)</p>
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
            </OpsPanel>

            <OpsPanel className="space-y-1 md:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Gitleaks timeout (s)</p>
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
            </OpsPanel>
        </OpsCard>

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={saving} type="submit">
            {saving ? "Saving..." : "Save policy"}
          </Button>
          {savedMessage ? <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">{savedMessage}</p> : null}
          {error ? <p className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700">{error}</p> : null}
        </div>
      </form>
    </PageShell>
  );
}

function PolicyToggle({
  checked,
  description,
  label,
  onCheckedChange,
}: {
  checked: boolean;
  description: string;
  label: string;
  onCheckedChange: (value: boolean) => void;
}) {
  const fieldId = `policy-tool-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <OpsPanel className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
      <label className="flex items-center gap-2" htmlFor={fieldId}>
        <input checked={checked} id={fieldId} onChange={(event) => onCheckedChange(event.target.checked)} type="checkbox" />
        {label}
      </label>
      <InfoPopover description={description} title={label} />
    </OpsPanel>
  );
}

function InfoPopover({ title, description }: { title: string; description: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label={`What is ${title}?`}
          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 hover:text-slate-700"
          type="button"
        >
          <CircleHelp className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-700">{description}</p>
      </PopoverContent>
    </Popover>
  );
}

function PolicyInfo({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return <OpsMetricCard icon={Icon} label={title} value={value} />;
}

function PolicySkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-300 bg-white p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="mt-3 h-7 w-36" />
        <Skeleton className="mt-2 h-4 w-60 max-w-full" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="space-y-3 rounded-2xl border border-slate-300 bg-white p-4">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
