"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { saveTokens } from "@/lib/auth";
import { ApiError, login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [nextPath, setNextPath] = useState("/dashboard");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    if (next) {
      setNextPath(next);
    }
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const tokens = await login(username, password);
      saveTokens(tokens);
      router.push(nextPath);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Unable to login right now.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] p-4">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_center,_#fde68a_0,_transparent_35%),radial-gradient(circle_at_bottom_right,_#c7d2fe_0,_transparent_35%)]" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to run scans and review findings.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input
              autoComplete="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              value={username}
            />
            <Input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
              value={password}
            />
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-[var(--ink-muted)]">
            Need an account? <Link className="text-[var(--brand-700)]" href="/register">Create one</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
