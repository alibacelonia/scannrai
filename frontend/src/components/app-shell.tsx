"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, LogOut, ShieldAlert } from "lucide-react";

import { clearTokens } from "@/lib/auth";
import { cn } from "@/lib/utils";

const navItems = [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const logout = () => {
    clearTokens();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,_#ffd7aa_0,_transparent_32%),radial-gradient(circle_at_bottom_right,_#bfdbfe_0,_transparent_36%)]" />
      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm">
          <div className="mb-6 flex items-center gap-2 px-2">
            <ShieldAlert className="h-5 w-5 text-[var(--brand-700)]" />
            <span className="font-semibold tracking-tight">ScannrAI</span>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    active ? "bg-[var(--brand-100)] text-[var(--brand-900)]" : "text-[var(--ink-muted)] hover:bg-[var(--muted)]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-full flex-col gap-4">
          <header className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-white px-5 py-4 shadow-sm">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-[var(--ink-muted)]">Security Workspace</p>
              <h1 className="text-lg font-semibold">AI Code Reviewer</h1>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--ink-muted)] hover:bg-[var(--muted)]"
              type="button"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </header>
          <main className="min-h-[70vh] rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">{children}</main>
        </div>
      </div>
    </div>
  );
}
