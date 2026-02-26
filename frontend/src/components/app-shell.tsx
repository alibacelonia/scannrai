"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FolderGit2, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Settings2, ShieldAlert, X } from "lucide-react";
import { ScanSearch } from "lucide-react";

import { clearTokens } from "@/lib/auth";
import { cn } from "@/lib/utils";

const SIDEBAR_WIDTH_EXPANDED = 224;
const SIDEBAR_WIDTH_COLLAPSED = 48;

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Repositories", icon: FolderGit2 },
  { href: "/scans", label: "Scans", icon: ScanSearch },
  { href: "/policy", label: "Policy", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = mobileDrawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileDrawerOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const logout = () => {
    clearTokens();
    setMobileDrawerOpen(false);
    router.push("/login");
  };

  const sidebarWidthClass = desktopCollapsed ? "md:pl-12" : "md:pl-56";
  const currentSectionLabel = useMemo(() => {
    if (pathname.startsWith("/policy")) return "Policy";
    if (pathname.startsWith("/projects/")) return "Repository";
    if (pathname.startsWith("/projects")) return "Repositories";
    if (pathname.startsWith("/scans/")) return "Scan";
    if (pathname.startsWith("/scans")) return "Scans";
    return "Dashboard";
  }, [pathname]);

  const renderNav = (compact = false) => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMobileDrawerOpen(false)}
            className={cn(
              "group flex items-center rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
              compact && "justify-center px-0",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!compact ? <span className="ml-3">{item.label}</span> : <span className="sr-only">{item.label}</span>}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white transition-[width] duration-200 md:flex md:flex-col"
        style={{ width: desktopCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      >
        <div className={cn("flex h-14 items-center border-b border-slate-200 px-3", desktopCollapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-900" />
            {!desktopCollapsed ? <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">ScannrAI</span> : null}
          </div>
          <button
            aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn("rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900", desktopCollapsed && "hidden")}
            onClick={() => setDesktopCollapsed((value) => !value)}
            type="button"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">{renderNav(desktopCollapsed)}</div>
        <div className="border-t border-slate-200 p-2">
          <button
            aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex w-full items-center rounded-lg px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:bg-slate-100 hover:text-slate-900",
              desktopCollapsed && "justify-center px-0",
            )}
            onClick={() => setDesktopCollapsed((value) => !value)}
            type="button"
          >
            {desktopCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!desktopCollapsed ? <span className="ml-2">Collapse</span> : null}
          </button>
        </div>
      </aside>

      <button
        aria-controls="mobile-nav-drawer"
        aria-expanded={mobileDrawerOpen}
        aria-label={mobileDrawerOpen ? "Close navigation menu" : "Open navigation menu"}
        className="fixed right-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white shadow-sm md:hidden"
        onClick={() => setMobileDrawerOpen((value) => !value)}
        type="button"
      >
        <span className="relative h-4 w-5">
          <span
            className={cn(
              "absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1.5 bg-slate-900 transition-transform duration-200",
              mobileDrawerOpen && "translate-y-0 rotate-45",
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-1/2 h-0.5 w-5 -translate-y-1/2 bg-slate-900 transition-opacity duration-200",
              mobileDrawerOpen && "opacity-0",
            )}
          />
          <span
            className={cn(
              "absolute left-0 top-1/2 h-0.5 w-5 translate-y-0.5 bg-slate-900 transition-transform duration-200",
              mobileDrawerOpen && "-translate-y-0 rotate-[-45deg]",
            )}
          />
        </span>
      </button>

      <button
        aria-hidden={!mobileDrawerOpen}
        className={cn(
          "fixed inset-0 z-40 bg-slate-900/40 transition-opacity md:hidden",
          mobileDrawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileDrawerOpen(false)}
        tabIndex={mobileDrawerOpen ? 0 : -1}
        type="button"
      />

      <aside
        aria-label="Mobile navigation"
        aria-modal="true"
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-72 border-l border-slate-200 bg-white p-4 shadow-2xl transition-transform md:hidden",
          mobileDrawerOpen ? "translate-x-0" : "translate-x-full",
        )}
        id="mobile-nav-drawer"
        role="dialog"
      >
        <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-slate-900" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">ScannrAI</span>
          </div>
          <button
            aria-label="Close navigation menu"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            onClick={() => setMobileDrawerOpen(false)}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {renderNav(false)}
        <div className="mt-4 border-t border-slate-200 pt-3">
          <button
            className="inline-flex w-full items-center justify-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-slate-800"
            onClick={logout}
            type="button"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <div className={cn("min-h-screen transition-[padding-left] duration-200", sidebarWidthClass)}>
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
          <div className="px-4 py-3 sm:px-6 md:py-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Authenticated Area</p>
                <p className="text-xs text-slate-700">{currentSectionLabel}</p>
              </div>
              <button
                className="hidden items-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white hover:bg-slate-800 md:inline-flex"
                onClick={logout}
                type="button"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="px-4 py-4 pb-20 sm:px-6">{children}</main>
      </div>

      <footer
        className={cn(
          "fixed bottom-0 right-0 z-20 hidden items-center justify-between border-t border-slate-200 bg-slate-50/100 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 backdrop-blur md:flex",
          desktopCollapsed ? "left-12" : "left-56",
        )}
      >
        <span>Local scan paths must be container-visible</span>
        <span className="text-slate-400">/host/home/...</span>
      </footer>
    </div>
  );
}
