import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PhasePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "Analytics — PGT CS Workbench" },
      { name: "description", content: "Preparation analytics for PGT Computer Science." },
      { property: "og:title", content: "Analytics — PGT CS Workbench" },
      { property: "og:description", content: "Preparation analytics for PGT Computer Science." },
    ],
  }),
  component: () => (
    <AppShell title="Analytics" description="Preparation analytics">
      <PhasePlaceholder feature="Analytics" />
    </AppShell>
  ),
});
