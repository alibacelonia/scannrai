"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] p-4">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,_#fed7aa_0,_transparent_35%),radial-gradient(circle_at_bottom_left,_#bfdbfe_0,_transparent_35%)]" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>Set up a ScannrAI workspace account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <Input onChange={(event) => setUsername(event.target.value)} placeholder="Username" value={username} />
            <Input onChange={(event) => setEmail(event.target.value)} placeholder="Email" type="email" value={email} />
            <Input
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              type="password"
              value={password}
            />
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <Button className="w-full" disabled={loading} type="submit">
              {loading ? "Creating..." : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-[var(--ink-muted)]">
            Already have one? <Link className="text-[var(--brand-700)]" href="/login">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
