"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Clock3, Mail, ShieldCheck, User2 } from "lucide-react";
import { toast } from "sonner";

import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OpsCard, OpsPanel } from "@/components/ui/ops-card";
import { ApiError, getMe, updateMeProfile } from "@/lib/api";
import type { User } from "@/types/api";

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [bio, setBio] = useState("");

  useEffect(() => {
    let mounted = true;
    void getMe()
      .then((data) => {
        if (mounted) {
          setUser(data);
          setFullName(data.profile?.full_name ?? "");
          setJobTitle(data.profile?.job_title ?? "");
          setBio(data.profile?.bio ?? "");
        }
      })
      .catch((err) => {
        if (!mounted) {
          return;
        }
        if (err instanceof ApiError) {
          toast.error(err.message);
        } else {
          toast.error("Unable to load profile.");
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

  const safeNextPath = useMemo(() => {
    const nextPath = searchParams.get("next_url") || searchParams.get("next");
    if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//") || nextPath.startsWith("/profile")) {
      return null;
    }
    return nextPath;
  }, [searchParams]);

  const displayName = useMemo(() => {
    const profileName = user?.profile?.full_name?.trim();
    if (profileName) {
      return profileName;
    }
    return user?.username || "Unknown user";
  }, [user]);

  const initials = useMemo(() => {
    const source = (displayName || user?.email || "AC").trim();
    if (!source) {
      return "AC";
    }
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [displayName, user]);

  const submitProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user) {
      return;
    }
    if (!fullName.trim()) {
      toast.error("Full name is required to complete your profile.");
      return;
    }

    setSaving(true);
    const wasIncomplete = !user.has_completed_profile;
    try {
      const updated = await updateMeProfile({
        full_name: fullName.trim(),
        job_title: jobTitle.trim(),
        bio: bio.trim(),
      });
      setUser(updated);
      toast.success("Profile saved.");
      if (updated.has_completed_profile && (wasIncomplete || Boolean(safeNextPath))) {
        router.replace(safeNextPath ?? "/dashboard");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Unable to save profile.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell eyebrow="Account" title="Profile" description="Set your profile details for your authenticated workspace.">
      {user && !user.has_completed_profile ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          Complete your profile to continue.
        </p>
      ) : null}

      <OpsPanel className="rounded-2xl border border-slate-300 bg-white p-5">
        <div className="flex items-start gap-4">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-base font-semibold text-white">
            {loading ? ".." : initials}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Account</p>
            <p className="truncate text-xl font-semibold text-slate-900">{loading ? "Loading..." : displayName}</p>
            <p className="truncate text-sm text-slate-600">{loading ? "Fetching email..." : user?.email || "No email available"}</p>
          </div>
        </div>
      </OpsPanel>

      <section className="grid gap-4 lg:grid-cols-2">
        <OpsCard
          chipDotClassName="bg-emerald-500"
          chipLabel="Profile Setup"
          description="Manage your profile information used across the workspace."
          icon={User2}
          title="Edit profile"
          contentClassName="space-y-3"
        >
          <form className="space-y-3" onSubmit={submitProfile}>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Full name</label>
              <Input onChange={(event) => setFullName(event.target.value)} placeholder="Your full name" value={fullName} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Job title</label>
              <Input onChange={(event) => setJobTitle(event.target.value)} placeholder="Security Engineer" value={jobTitle} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Bio</label>
              <textarea
                className="flex min-h-24 w-full rounded-lg border-0 bg-slate-100 px-3 py-2 text-xs text-[var(--ink)] shadow-none placeholder:text-[var(--ink-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                onChange={(event) => setBio(event.target.value)}
                placeholder="Short profile summary"
                value={bio}
              />
            </div>
            <Button disabled={saving} type="submit">
              {saving ? "Saving..." : "Save profile"}
            </Button>
          </form>
        </OpsCard>

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
            <ProfileRow icon={ShieldCheck} label="Profile status" value={loading ? "Loading..." : user?.has_completed_profile ? "Complete" : "Incomplete"} />
        </OpsCard>
      </section>

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
