"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getAccessToken, subscribeToAuthToken } from "@/lib/auth";

const SERVER_TOKEN_SNAPSHOT = "__SCANNRAI_SERVER__";
const EMPTY_TOKEN_SNAPSHOT = "__SCANNRAI_EMPTY__";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const tokenSnapshot = useSyncExternalStore(
    subscribeToAuthToken,
    () => getAccessToken() ?? EMPTY_TOKEN_SNAPSHOT,
    () => SERVER_TOKEN_SNAPSHOT,
  );
  const hydrated = tokenSnapshot !== SERVER_TOKEN_SNAPSHOT;
  const token = hydrated && tokenSnapshot !== EMPTY_TOKEN_SNAPSHOT ? tokenSnapshot : null;

  useEffect(() => {
    if (hydrated && !token) {
      router.replace(`/login?next_url=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, pathname, router, token]);

  if (!hydrated || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] px-4 py-3 text-xs text-[var(--ink-muted)] shadow-sm">
          Checking session...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
