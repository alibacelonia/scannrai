"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowRight, UserPlus2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveTokens } from "@/lib/auth";
import { ApiError, login, register } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await register(username, email, password);
      const tokens = await login(username, password);
      saveTokens(tokens);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to create account right now.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_0%_100%,rgba(15,23,42,0.17),transparent_35%),radial-gradient(circle_at_100%_0%,rgba(148,163,184,0.28),transparent_42%)]" />
      <Card className="relative w-full max-w-md">
        <CardHeader className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">Workspace Access</p>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus2 className="h-5 w-5 text-slate-700" />
            Create account
          </CardTitle>
          <CardDescription>Create your ScannrAI login to run repository scans.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Username</label>
              <Input onChange={(event) => setUsername(event.target.value)} placeholder="your-username" value={username} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Email</label>
              <Input onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-[0.11em] text-[var(--ink-subtle)]">Password</label>
              <Input
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Create password"
                type="password"
                value={password}
              />
            </div>
            {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p> : null}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Creating..." : "Create account"}
              {!loading ? <ArrowRight className="ml-2 h-3.5 w-3.5" /> : null}
            </Button>
          </form>
          <p className="mt-4 text-xs text-[var(--ink-muted)]">
            Already have one?{" "}
            <Link className="font-semibold text-[var(--ink)] hover:underline" href="/login">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
