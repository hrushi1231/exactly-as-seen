import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PhasePlaceholder } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/pyq")({
  head: () => ({
    meta: [
      { title: "PYQs — PGT CS Workbench" },
      {
        name: "description",
        content: "Previous-year questions for PGT Computer Science examinations.",
      },
      { property: "og:title", content: "PYQs — PGT CS Workbench" },
      {
        property: "og:description",
        content: "Previous-year questions for PGT Computer Science examinations.",
      },
    ],
  }),
  component: () => (
    <AppShell title="PYQs" description="Previous-year questions">
      <PhasePlaceholder feature="Previous-year questions" />
    </AppShell>
  ),
});
