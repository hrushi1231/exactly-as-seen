import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileStack,
  GraduationCap,
  LayoutList,
  LineChart,
  Library,
  LogOut,
  Menu,
  Repeat,
  Settings,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

type NavItem = { to: string; label: string; icon: typeof CalendarCheck };

const primaryNav: NavItem[] = [
  { to: "/today", label: "Today", icon: CalendarCheck },
  { to: "/roadmap", label: "Roadmap", icon: LayoutList },
];

const studyNav: NavItem[] = [
  { to: "/learn", label: "Learn", icon: BookOpen },
  { to: "/pyq", label: "PYQs", icon: FileStack },
  { to: "/mocks", label: "Mocks", icon: ClipboardList },
  { to: "/revision", label: "Revision", icon: Repeat },
];

const insightNav: NavItem[] = [{ to: "/analytics", label: "Analytics", icon: LineChart }];

const adminNav: NavItem[] = [
  { to: "/admin/exams", label: "Exams", icon: GraduationCap },
  { to: "/admin/syllabus", label: "Syllabus", icon: Library },
  { to: "/admin/sources", label: "Sources", icon: Settings },
];

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          activeProps={{
            className: "bg-secondary text-foreground font-medium",
          }}
          activeOptions={{ exact: false }}
        >
          <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>{item.label}</span>
        </Link>
      ))}
    </div>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-4 py-4">
        <div className="text-sm font-semibold tracking-tight">PGT CS Workbench</div>
        <div className="mt-0.5 text-xs text-muted-foreground">Preparation system</div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2.5 py-4">
        <NavLinks items={primaryNav} onNavigate={onNavigate} />
        <div className="border-t border-border pt-4">
          <NavLinks items={studyNav} onNavigate={onNavigate} />
        </div>
        <div className="border-t border-border pt-4">
          <NavLinks items={insightNav} onNavigate={onNavigate} />
        </div>
        {isAdmin && (
          <div className="border-t border-border pt-4">
            <div className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Admin
            </div>
            <NavLinks items={adminNav} onNavigate={onNavigate} />
          </div>
        )}
      </nav>

      <div className="border-t border-border px-4 py-3">
        <div className="text-xs font-medium text-foreground">OAVS PGT CS</div>
        <div className="text-xs text-muted-foreground">120-Day Preparation</div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate text-[11px] text-muted-foreground">{user?.email}</span>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="h-3 w-3" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-border bg-card lg:block">
        <SidebarContent />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-foreground/20"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-64 border-r border-border bg-card">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-2 top-3 rounded-md p-1 text-muted-foreground hover:bg-secondary"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
            <button
              onClick={() => setOpen(true)}
              className="rounded-md border border-border p-1.5 text-muted-foreground lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
              {description && (
                <p className="truncate text-xs text-muted-foreground">{description}</p>
              )}
            </div>
            {actions}
          </div>
        </header>
        <main className={cn("px-4 py-6 sm:px-6")}>{children}</main>
      </div>
    </div>
  );
}

export function PhasePlaceholder({ feature }: { feature: string }) {
  return (
    <div className="mx-auto max-w-lg rounded-md border border-dashed border-border bg-card px-6 py-14 text-center">
      <h2 className="text-sm font-semibold text-foreground">{feature} arrives in a later phase</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Phase 01 covers the application foundation, exam configuration and syllabus management. This
        section will be built once that groundwork is in place.
      </p>
    </div>
  );
}
