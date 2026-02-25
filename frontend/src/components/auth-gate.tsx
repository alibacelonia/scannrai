"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { getAccessToken } from "@/lib/auth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = getAccessToken();

  useEffect(() => {
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [pathname, router, token]);

  if (!token) {
    return <div className="p-10 text-sm text-[var(--ink-muted)]">Checking session...</div>;
  }

  return <>{children}</>;
}
