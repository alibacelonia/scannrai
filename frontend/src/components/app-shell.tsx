"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  ChevronsUpDown,
  FolderGit2,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ScanSearch,
  Settings2,
  Shield,
  UserCircle2,
  X,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMe } from "@/lib/api";
import { clearTokens } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { User } from "@/types/api";

const SIDEBAR_WIDTH_EXPANDED = 224;
const SIDEBAR_WIDTH_COLLAPSED = 72;
const SIDEBAR_COLLAPSED_STORAGE_KEY = "scannrai.sidebar.collapsed";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Repositories", icon: FolderGit2 },
  { href: "/scans", label: "Scans", icon: ScanSearch },
  { href: "/policy", label: "Policy", icon: Settings2 },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-900 text-[11px] font-semibold text-white",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [authUser, setAuthUser] = useState<User | null>(null);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);
  const [sidebarStateReady, setSidebarStateReady] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useLayoutEffect(() => {
    try {
      const storedValue = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (storedValue === "1") {
        setDesktopCollapsed(true);
      }
    } finally {
      setSidebarStateReady(true);
    }
  }, []);

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

  useEffect(() => {
    if (!sidebarStateReady) {
      return;
    }
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, desktopCollapsed ? "1" : "0");
  }, [desktopCollapsed, sidebarStateReady]);

  useEffect(() => {
    let mounted = true;
    void getMe()
      .then((user) => {
        if (mounted) {
          setAuthUser(user);
        }
      })
      .catch(() => {
        if (mounted) {
          setAuthUser(null);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const accountName = authUser?.username || "Account";
  const accountEmail = authUser?.email || "No email";
  const accountInitials = useMemo(() => {
    const source = (authUser?.username || authUser?.email || "AC").trim();
    if (!source) {
      return "AC";
    }
    const parts = source.split(/[\s._-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [authUser]);

  const currentSectionLabel = useMemo(() => {
    if (pathname.startsWith("/policy")) return "Policy";
    if (pathname.startsWith("/projects")) return "Repositories";
    if (pathname.startsWith("/scans")) return "Scans";
    return "Dashboard";
  }, [pathname]);

  const logout = () => {
    clearTokens();
    setMobileDrawerOpen(false);
    router.push("/login");
  };

  const contentPaddingLeft = desktopCollapsed ? "md:pl-[72px]" : "md:pl-56";

  const renderNav = (compact: boolean, closeMobileOnClick: boolean) => (
    <nav className="space-y-1.5">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => {
              if (closeMobileOnClick) {
                setMobileDrawerOpen(false);
              }
            }}
            className={cn(
              "group flex items-center rounded-xl px-3 py-2.5 text-[13px] transition",
              active
                ? "bg-white text-slate-900"
                : "text-slate-700 hover:bg-slate-100",
              compact && "justify-center px-0",
            )}
            title={compact ? item.label : undefined}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-4 w-4 shrink-0" />
              {compact ? <span className="sr-only">{item.label}</span> : <span className="font-medium">{item.label}</span>}
            </div>
          </Link>
        );
      })}
    </nav>
  );

  const accountMenu = (mode: "compact" | "expanded" | "mobile") => {
    const triggerClass =
      mode === "compact"
        ? "inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-800 hover:bg-slate-100"
        : "flex w-full items-center gap-2 rounded-xl px-1.5 py-1.5 text-left hover:bg-slate-100";

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button aria-label="Open profile menu" className={triggerClass} type="button">
            <Avatar className="h-8 w-8" initials={accountInitials} />
            {mode !== "compact" ? (
              <>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-slate-900">{accountName}</p>
                  <p className="truncate text-xs text-slate-500">{accountEmail}</p>
                </div>
                <ChevronsUpDown className="ml-auto h-4 w-4 text-slate-500" />
              </>
            ) : null}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64"
          side="right"
          sideOffset={8}
        >
          <DropdownMenuLabel className="normal-case">
            <div className="flex items-center gap-2">
              <Avatar className="h-9 w-9" initials={accountInitials} />
              <div className="min-w-0">
                <p className="truncate text-[13px] font-normal text-slate-900">{accountName}</p>
                <p className="truncate text-[11px] font-normal text-slate-500">{accountEmail}</p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="text-xs font-normal">
            <Link className="cursor-pointer text-xs font-normal" href="/profile" onClick={() => setMobileDrawerOpen(false)}>
              <UserCircle2 className="mr-2 h-4 w-4" />
              Account
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="text-xs font-normal text-red-700 focus:bg-red-50 focus:text-red-800"
            onSelect={(event) => {
              event.preventDefault();
              logout();
            }}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const sidebar = (
    <>
      <div className={cn("p-3", desktopCollapsed ? "px-2" : "px-3")}>
        <div className={cn("flex p-1", desktopCollapsed ? "justify-center" : "items-center justify-between")}>
          {!desktopCollapsed ? (
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <Shield className="h-4 w-4" />
              </span>
              <div>
                <p className="text-[13px] font-semibold text-slate-900">ScannrAI</p>
                <p className="text-xs text-slate-500">Enterprise</p>
              </div>
            </div>
          ) : null}
          <button
            aria-label={desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
            onClick={() => setDesktopCollapsed((prev) => !prev)}
            type="button"
          >
            {desktopCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto p-2.5">
        {!desktopCollapsed ? <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Workspace</p> : null}
        {renderNav(desktopCollapsed, false)}
      </div>

      <div className="p-2.5">
        <div className={cn(desktopCollapsed ? "flex items-center justify-center" : "")}>{accountMenu(desktopCollapsed ? "compact" : "expanded")}</div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen text-[var(--ink)]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-[#f8f8f8] md:flex md:flex-col",
          sidebarStateReady ? "transition-[width] duration-200" : "",
        )}
        style={{ width: desktopCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED }}
      >
        {sidebar}
      </aside>

      <button
        aria-controls="mobile-nav-drawer"
        aria-expanded={mobileDrawerOpen}
        aria-label={mobileDrawerOpen ? "Close navigation menu" : "Open navigation menu"}
        className="fixed left-4 top-4 z-50 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-white/90 text-[var(--ink)] shadow-md backdrop-blur md:hidden"
        onClick={() => setMobileDrawerOpen((prev) => !prev)}
        type="button"
      >
        {mobileDrawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      <button
        aria-hidden={!mobileDrawerOpen}
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[1px] transition-opacity md:hidden",
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
          "fixed inset-y-0 left-0 z-50 w-72 border-r border-slate-200 bg-[#f8f8f8] p-0 shadow-2xl transition-transform md:hidden",
          mobileDrawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
        id="mobile-nav-drawer"
        role="dialog"
      >
        <div className="flex h-full flex-col">
          <div className="p-3">
            <div className="flex items-center justify-between p-1">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <Shield className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">ScannrAI</p>
                  <p className="text-xs text-slate-500">Enterprise</p>
                </div>
              </div>
              <button
                aria-label="Close navigation menu"
                className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
                onClick={() => setMobileDrawerOpen(false)}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="no-scrollbar flex-1 overflow-y-auto p-2.5">
            <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500">Workspace</p>
            {renderNav(false, true)}
          </div>

          <div className="p-2.5">{accountMenu("mobile")}</div>
        </div>
      </aside>

      <div className={cn("min-h-screen", sidebarStateReady ? "transition-[padding-left] duration-200" : "", contentPaddingLeft)}>
        <header className="sticky top-0 z-20 border-b border-[var(--border)] bg-white/85 backdrop-blur">
          <div className="px-4 py-3 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="pl-12 md:pl-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-subtle)]">Authenticated Area</p>
                <p className="text-xs text-[var(--ink-muted)]">{currentSectionLabel}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="px-4 py-4 pb-20 sm:px-6">{children}</main>
      </div>

      <footer
        className={cn(
          "fixed bottom-0 right-0 z-20 hidden items-center justify-between border-t border-[var(--border)] bg-white/95 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--ink-subtle)] backdrop-blur md:flex",
          desktopCollapsed ? "left-[72px]" : "left-56",
        )}
      >
        <span>Local scan paths must be container-visible</span>
        <span className="text-slate-400">/host/home/... or /Users/...</span>
      </footer>
    </div>
  );
}
