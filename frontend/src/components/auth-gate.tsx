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
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [hydrated, pathname, router, token]);

  if (!hydrated || !token) {
    return <div className="p-10 text-sm text-[var(--ink-muted)]">Checking session...</div>;
  }

  return <>{children}</>;
}
