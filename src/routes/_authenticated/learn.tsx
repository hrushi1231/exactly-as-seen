import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PhasePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/learn")({
  head: () => ({
    meta: [
      { title: "Learn — PGT CS Workbench" },
      { name: "description", content: "Learning resources for PGT Computer Science preparation." },
      { property: "og:title", content: "Learn — PGT CS Workbench" },
      {
        property: "og:description",
        content: "Learning resources for PGT Computer Science preparation.",
      },
    ],
  }),
  component: () => (
    <AppShell title="Learn" description="Lessons and study resources">
      <PhasePlaceholder feature="Learning resources" />
    </AppShell>
  ),
});
