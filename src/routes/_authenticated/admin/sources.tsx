import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PhasePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/admin/sources")({
  head: () => ({
    meta: [
      { title: "Sources — PGT CS Workbench" },
      { name: "description", content: "Source material management for exam preparation content." },
      { property: "og:title", content: "Sources — PGT CS Workbench" },
      {
        property: "og:description",
        content: "Source material management for exam preparation content.",
      },
    ],
  }),
  component: () => (
    <AppShell title="Sources" description="Source material registry">
      <PhasePlaceholder feature="Source management" />
    </AppShell>
  ),
});
