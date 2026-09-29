import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PhasePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/revision")({
  head: () => ({
    meta: [
      { title: "Revision — PGT CS Workbench" },
      { name: "description", content: "Revision planning for PGT Computer Science preparation." },
      { property: "og:title", content: "Revision — PGT CS Workbench" },
      {
        property: "og:description",
        content: "Revision planning for PGT Computer Science preparation.",
      },
    ],
  }),
  component: () => (
    <AppShell title="Revision" description="Revision cycles">
      <PhasePlaceholder feature="Revision planning" />
    </AppShell>
  ),
});
