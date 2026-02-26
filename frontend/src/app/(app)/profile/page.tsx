"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Mail, ShieldCheck, User2 } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { OpsCard, OpsPanel } from "@/components/ui/ops-card";
import { ApiError, getMe } from "@/lib/api";
import type { User } from "@/types/api";

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void getMe()
      .then((data) => {
        if (mounted) {
          setUser(data);
        }
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Unable to load profile.");
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const initials = useMemo(() => {
    const source = (user?.username || user?.email || "AC").trim();
    if (!source) {
      return "AC";
    }
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [user]);

  return (
    <PageShell eyebrow="Account" title="Profile" description="Authenticated workspace identity and session details.">
      <OpsPanel className="rounded-2xl border border-slate-300 bg-white p-5">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-base font-semibold text-white">
            {loading ? ".." : initials}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Account</p>
            <p className="truncate text-xl font-semibold text-slate-900">{loading ? "Loading..." : user?.username || "Unknown user"}</p>
            <p className="truncate text-sm text-slate-600">{loading ? "Fetching email..." : user?.email || "No email available"}</p>
          </div>
        </div>
      </OpsPanel>

      <section className="grid gap-4 lg:grid-cols-2">
        <OpsCard
          chipDotClassName="bg-violet-500"
          chipLabel="Identity"
          description="Core authenticated account fields."
          icon={User2}
          title="Identity"
          contentClassName="space-y-3"
        >
            <ProfileRow icon={User2} label="Username" value={loading ? "Loading..." : user?.username || "-"} />
            <ProfileRow icon={Mail} label="Email" value={loading ? "Loading..." : user?.email || "-"} />
            <ProfileRow icon={ShieldCheck} label="User ID" value={loading ? "Loading..." : String(user?.id ?? "-")} />
        </OpsCard>

        <OpsCard
          chipDotClassName="bg-sky-500"
          chipLabel="Session"
          description="Active browser authorization details."
          icon={Clock3}
          title="Session"
          contentClassName="space-y-3 text-xs text-slate-600"
        >
            <ProfileRow icon={Clock3} label="Status" value={loading ? "Checking..." : "Authenticated"} />
            <p className="rounded-xl bg-slate-100/90 px-3 py-2 text-xs text-slate-600">
              This session is active in your browser and used for API authorization.
            </p>
            <p className="rounded-xl bg-slate-100/90 px-3 py-2 text-xs text-slate-600">
              Signing out from the sidebar profile menu will clear local tokens and redirect to login.
            </p>
        </OpsCard>
      </section>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
      ) : null}
    </PageShell>
  );
}

function ProfileRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-100/90 px-3 py-2">
      <Icon className="h-4 w-4 text-slate-500" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">{label}</p>
        <p className="truncate text-sm text-slate-900">{value}</p>
      </div>
    </div>
  );
}
