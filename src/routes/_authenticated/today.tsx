import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchExams,
  fetchMappings,
  fetchProgress,
  fetchSubtopics,
  fetchTopics,
  type EntityType,
} from "@/lib/syllabus";

export const Route = createFileRoute("/_authenticated/today")({
  head: () => ({
    meta: [
      { title: "Today — PGT CS Workbench" },
      {
        name: "description",
        content: "Daily preparation dashboard for OAVS PGT Computer Science.",
      },
      { property: "og:title", content: "Today — PGT CS Workbench" },
      {
        property: "og:description",
        content: "Daily preparation dashboard for OAVS PGT Computer Science.",
      },
    ],
  }),
  component: TodayPage,
});

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function TodayPage() {
  const { userId } = useAuth();

  const exams = useQuery({ queryKey: ["exams"], queryFn: fetchExams });
  const topics = useQuery({ queryKey: ["topics"], queryFn: fetchTopics });
  const subtopics = useQuery({ queryKey: ["subtopics"], queryFn: fetchSubtopics });
  const mappings = useQuery({ queryKey: ["mappings"], queryFn: fetchMappings });
  const progress = useQuery({
    queryKey: ["progress", userId],
    queryFn: () => fetchProgress(userId!),
    enabled: Boolean(userId),
  });

  const primaryExam = exams.data?.find((e) => e.is_primary) ?? null;

  const included = new Set(
    (mappings.data ?? [])
      .filter((m) => m.is_included && primaryExam && m.exam_id === primaryExam.id)
      .map((m) => `${m.entity_type}:${m.entity_id}`),
  );

  const units: Array<{ type: EntityType; id: string }> = [
    ...(topics.data ?? []).map((t) => ({ type: "topic" as EntityType, id: t.id })),
    ...(subtopics.data ?? []).map((s) => ({ type: "subtopic" as EntityType, id: s.id })),
  ].filter((u) => included.has(`${u.type}:${u.id}`));

  const completedKeys = new Set(
    (progress.data ?? [])
      .filter((p) => p.status === "completed")
      .map((p) => `${p.entity_type}:${p.entity_id}`),
  );

  const total = units.length;
  const done = units.filter((u) => completedKeys.has(`${u.type}:${u.id}`)).length;
  const remaining = total - done;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <AppShell
      title={primaryExam?.name ?? "Today"}
      description={primaryExam ? "Primary examination" : undefined}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-md border border-border bg-card p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">Today's study</h2>
            <span className="text-xs text-muted-foreground">6-hour daily target</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Study plan will be generated after the syllabus is configured.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Roadmap progress</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label="Progress"
              value={total > 0 ? `${percent}%` : "—"}
              hint={total > 0 ? `${done} of ${total} units` : "No syllabus mapped yet"}
            />
            <Stat label="Topics completed" value={total > 0 ? String(done) : "—"} />
            <Stat label="Topics remaining" value={total > 0 ? String(remaining) : "—"} />
          </div>
          {total > 0 && (
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
            </div>
          )}
          {total === 0 && (
            <p className="text-sm text-muted-foreground">
              No syllabus units are mapped to this exam yet. Once the syllabus is configured, these
              counts will be calculated from it.{" "}
              <Link to="/roadmap" className="text-primary underline underline-offset-2">
                Open the roadmap
              </Link>
            </p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
