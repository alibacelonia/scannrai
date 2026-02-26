"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { OpsCard, OpsPanel } from "@/components/ui/ops-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveTokens } from "@/lib/auth";
import { ApiError, getMe, login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/dashboard");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next_url") || params.get("next");
    if (next) {
      setNextPath(next);
    }
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const tokens = await login(username, password);
      saveTokens(tokens);
      const me = await getMe();
      if (!me.has_completed_profile) {
        const profileNext = nextPath && nextPath !== "/profile" ? nextPath : "/dashboard";
        router.push(`/profile?next_url=${encodeURIComponent(profileNext)}`);
        return;
      }
      router.push(nextPath);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.message);
      } else {
        toast.error("Unable to login right now.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(15,23,42,0.2),transparent_36%),radial-gradient(circle_at_100%_100%,rgba(148,163,184,0.35),transparent_42%)]" />
      <div className="relative w-full max-w-md">
        <OpsCard
          chipDotClassName="bg-emerald-500"
          chipLabel="ScannrAI"
          description="Access repositories, run scans, and review findings."
          icon={ShieldCheck}
          title="Sign in"
          contentClassName=""
        >
          <form className="space-y-4" onSubmit={onSubmit}>
            <OpsPanel className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Username</label>
              <Input
                autoComplete="username"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="your-username"
                value={username}
              />
            </OpsPanel>
            <OpsPanel className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Password</label>
              <Input
                autoComplete="current-password"
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                type="password"
                value={password}
              />
            </OpsPanel>
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
              {!loading ? <ArrowRight className="ml-2 h-3.5 w-3.5" /> : null}
            </Button>
          </form>
          <p className="mt-4 text-xs text-[var(--ink-muted)]">
            Need an account?{" "}
            <Link className="font-semibold text-[var(--ink)] hover:underline" href="/register">
              Create one
            </Link>
          </p>
        </OpsCard>
      </div>
    </div>
  );
}
