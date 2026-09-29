import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { isAdmin, roleLoaded, userId } = useAuth();

  if (!userId || !roleLoaded) {
    return (
      <AppShell title="Admin">
        <p className="text-sm text-muted-foreground">Checking permissions…</p>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell title="Admin" description="Restricted area">
        <div className="mx-auto max-w-lg rounded-md border border-border bg-card px-6 py-12 text-center">
          <h2 className="text-sm font-semibold">Administrator access required</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account does not have administrator permissions. Ask an administrator to grant
            them.
          </p>
        </div>
      </AppShell>
    );
  }

  return <Outlet />;
}
