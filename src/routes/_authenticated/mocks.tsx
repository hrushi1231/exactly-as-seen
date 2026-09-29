import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PhasePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/mocks")({
  head: () => ({
    meta: [
      { title: "Mocks — PGT CS Workbench" },
      { name: "description", content: "Mock examinations for PGT Computer Science preparation." },
      { property: "og:title", content: "Mocks — PGT CS Workbench" },
      {
        property: "og:description",
        content: "Mock examinations for PGT Computer Science preparation.",
      },
    ],
  }),
  component: () => (
    <AppShell title="Mocks" description="Mock examinations">
      <PhasePlaceholder feature="Mock examinations" />
    </AppShell>
  ),
});
