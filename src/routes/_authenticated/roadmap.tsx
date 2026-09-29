import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Check, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  fetchExams,
  fetchSources,
  fetchMappings,
  fetchProgress,
  fetchSubjects,
  fetchSubtopics,
  fetchTopics,
  formatMinutes,
  setProgress,
  type EntityType,
  type Exam,
  type Subject,
  type SyllabusSource,
  type Subtopic,
  type Topic,
} from "@/lib/syllabus";

export const Route = createFileRoute("/_authenticated/roadmap")({
  head: () => ({
    meta: [
      { title: "Roadmap — PGT CS Workbench" },
      {
        name: "description",
        content: "Hierarchical OAVS PGT Computer Science syllabus roadmap.",
      },
      { property: "og:title", content: "Roadmap — PGT CS Workbench" },
      {
        property: "og:description",
        content: "Hierarchical OAVS PGT Computer Science syllabus roadmap.",
      },
    ],
  }),
  component: RoadmapPage,
});

type Selected = { type: EntityType; id: string } | null;

function RoadmapPage() {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Selected>(null);
  const [search, setSearch] = useState("");

  const exams = useQuery({ queryKey: ["exams"], queryFn: fetchExams });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const topics = useQuery({ queryKey: ["topics"], queryFn: fetchTopics });
  const subtopics = useQuery({ queryKey: ["subtopics"], queryFn: fetchSubtopics });
  const mappings = useQuery({ queryKey: ["mappings"], queryFn: fetchMappings });
  const sources = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const progress = useQuery({
    queryKey: ["progress", userId],
    queryFn: () => fetchProgress(userId!),
    enabled: Boolean(userId),
  });

  const primaryExam = exams.data?.find((e) => e.is_primary) ?? null;

  const includedKeys = useMemo(
    () =>
      new Set(
        (mappings.data ?? [])
          .filter((m) => m.is_included && primaryExam && m.exam_id === primaryExam.id)
          .map((m) => `${m.entity_type}:${m.entity_id}`),
      ),
    [mappings.data, primaryExam],
  );

  const completed = useMemo(
    () =>
      new Set(
        (progress.data ?? [])
          .filter((p) => p.status === "completed")
          .map((p) => `${p.entity_type}:${p.entity_id}`),
      ),
    [progress.data],
  );

  const toggle = useMutation({
    mutationFn: async (input: { type: EntityType; id: string; done: boolean }) =>
      setProgress(userId!, input.type, input.id, input.done),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["progress", userId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const term = search.trim().toLowerCase();
  const matches = (name: string) => !term || name.toLowerCase().includes(term);

  const tree = useMemo(() => {
    const allTopics = topics.data ?? [];
    const allSubtopics = subtopics.data ?? [];
    return (subjects.data ?? [])
      .map((subject) => {
        const subjectTopics = allTopics
          .filter((t) => t.subject_id === subject.id && includedKeys.has(`topic:${t.id}`))
          .map((topic) => ({
            topic,
            subtopics: allSubtopics.filter(
              (s) => s.topic_id === topic.id && includedKeys.has(`subtopic:${s.id}`),
            ),
          }))
          .filter(
            (entry) =>
              matches(entry.topic.name) || entry.subtopics.some((s) => matches(s.name)) || !term,
          );
        return { subject, topics: subjectTopics };
      })
      .filter((entry) => entry.topics.length > 0 || includedKeys.has(`subject:${entry.subject.id}`))
      .filter((entry) => !term || matches(entry.subject.name) || entry.topics.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjects.data, topics.data, subtopics.data, includedKeys, term]);

  const loading =
    subjects.isLoading || topics.isLoading || subtopics.isLoading || mappings.isLoading;

  const selectedTopic =
    selected?.type === "topic" ? (topics.data ?? []).find((t) => t.id === selected.id) : undefined;
  const selectedSubtopic =
    selected?.type === "subtopic"
      ? (subtopics.data ?? []).find((s) => s.id === selected.id)
      : undefined;

  return (
    <AppShell
      title="Roadmap"
      description={primaryExam ? `${primaryExam.name} syllabus` : "Syllabus"}
      actions={
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search syllabus"
          className="hidden w-56 sm:block"
        />
      }
    >
      <div className="flex gap-6">
        <div className="min-w-0 flex-1 space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading syllabus…</p>}

          {!loading && tree.length === 0 && (
            <div className="rounded-md border border-dashed border-border bg-card px-6 py-12 text-center">
              <h2 className="text-sm font-semibold">No syllabus mapped yet</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Add subjects, topics and subtopics in Admin → Syllabus and map them to{" "}
                {primaryExam?.name ?? "the primary exam"}. Nothing is shown here until real syllabus
                records exist.
              </p>
            </div>
          )}

          {tree.map(({ subject, topics: subjectTopics }) => {
            const open = expanded[subject.id] ?? true;
            return (
              <div key={subject.id} className="rounded-md border border-border bg-card">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                  onClick={() => setExpanded((s) => ({ ...s, [subject.id]: !open }))}
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-semibold">{subject.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {subjectTopics.length} topic{subjectTopics.length === 1 ? "" : "s"}
                  </span>
                </button>

                {open && (
                  <div className="border-t border-border">
                    {subjectTopics.length === 0 && (
                      <p className="px-4 py-3 text-xs text-muted-foreground">
                        No topics mapped to this exam yet.
                      </p>
                    )}
                    {subjectTopics.map(({ topic, subtopics: subs }) => {
                      const topicOpen = expanded[topic.id] ?? false;
                      const isDone = completed.has(`topic:${topic.id}`);
                      return (
                        <div key={topic.id} className="border-b border-border last:border-b-0">
                          <div className="flex items-center gap-2 px-3 py-2">
                            <button
                              className="rounded p-0.5 text-muted-foreground hover:bg-secondary"
                              onClick={() => setExpanded((s) => ({ ...s, [topic.id]: !topicOpen }))}
                              aria-label="Toggle subtopics"
                            >
                              {topicOpen ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 accent-[var(--primary)]"
                              checked={isDone}
                              onChange={(e) =>
                                toggle.mutate({
                                  type: "topic",
                                  id: topic.id,
                                  done: e.target.checked,
                                })
                              }
                            />
                            <button
                              className="min-w-0 flex-1 truncate text-left text-sm hover:text-primary"
                              onClick={() => setSelected({ type: "topic", id: topic.id })}
                            >
                              {topic.name}
                            </button>
                            {formatMinutes(topic.estimated_minutes) && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {formatMinutes(topic.estimated_minutes)}
                              </span>
                            )}
                          </div>

                          {topicOpen && (
                            <div className="space-y-0.5 pb-2 pl-12 pr-3">
                              {subs.length === 0 && (
                                <p className="py-1 text-xs text-muted-foreground">No subtopics.</p>
                              )}
                              {subs.map((sub) => {
                                const subDone = completed.has(`subtopic:${sub.id}`);
                                return (
                                  <div key={sub.id} className="flex items-center gap-2 py-1">
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 accent-[var(--primary)]"
                                      checked={subDone}
                                      onChange={(e) =>
                                        toggle.mutate({
                                          type: "subtopic",
                                          id: sub.id,
                                          done: e.target.checked,
                                        })
                                      }
                                    />
                                    <button
                                      className="min-w-0 flex-1 truncate text-left text-sm text-muted-foreground hover:text-primary"
                                      onClick={() =>
                                        setSelected({ type: "subtopic", id: sub.id })
                                      }
                                    >
                                      {sub.name}
                                    </button>
                                    {formatMinutes(sub.estimated_minutes) && (
                                      <span className="shrink-0 text-xs text-muted-foreground">
                                        {formatMinutes(sub.estimated_minutes)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selected && (selectedTopic || selectedSubtopic) && (
          <DetailPanel
            topic={selectedTopic}
            subtopic={selectedSubtopic}
            subjects={subjects.data ?? []}
            topics={topics.data ?? []}
            exams={exams.data ?? []}
            mappings={mappings.data ?? []}
            sources={sources.data ?? []}
            isCompleted={completed.has(`${selected.type}:${selected.id}`)}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </AppShell>
  );
}

function DetailPanel({
  topic,
  subtopic,
  subjects,
  topics,
  exams,
  mappings,
  sources,
  isCompleted,
  onClose,
}: {
  topic?: Topic | undefined;
  subtopic?: Subtopic | undefined;
  subjects: Subject[];
  topics: Topic[];
  exams: Exam[];
  mappings: Array<{ exam_id: string; entity_type: EntityType; entity_id: string; is_included: boolean }>;
  sources: SyllabusSource[];
  isCompleted: boolean;
  onClose: () => void;
}) {
  const entityType: EntityType = topic ? "topic" : "subtopic";
  const entityId = topic?.id ?? subtopic?.id ?? "";
  const parentTopic = subtopic ? topics.find((t) => t.id === subtopic.topic_id) : topic;
  const subject = subjects.find((s) => s.id === parentTopic?.subject_id);
  const name = topic?.name ?? subtopic?.name ?? "";
  const description = topic?.description ?? subtopic?.description ?? null;
  const status = topic?.status ?? subtopic?.status ?? "active";
  const sourceText = topic?.source_text ?? subtopic?.source_text ?? null;
  const source = sources.find((s) => s.id === (topic?.source_id ?? subtopic?.source_id));
  const hierarchy = [subject?.name, subtopic ? parentTopic?.name : null].filter(Boolean).join(" › ");
  const minutes = formatMinutes(topic?.estimated_minutes ?? subtopic?.estimated_minutes);

  const coverage = exams.map((exam) => ({
    exam,
    included: mappings.some(
      (m) =>
        m.exam_id === exam.id &&
        m.entity_type === entityType &&
        m.entity_id === entityId &&
        m.is_included,
    ),
  }));

  return (
    <aside className="hidden w-80 shrink-0 self-start rounded-md border border-border bg-card p-4 xl:block">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {hierarchy || "Syllabus"}
          </div>
          <h2 className="mt-0.5 text-sm font-semibold">{name}</h2>
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-secondary"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {description && <p className="mt-3 text-sm text-muted-foreground">{description}</p>}
      {sourceText && (
        <blockquote className="mt-3 border-l-2 border-border pl-3 text-xs text-muted-foreground">
          {sourceText}
        </blockquote>
      )}

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Completion</dt>
          <dd>{isCompleted ? "Completed" : "Not started"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Record status</dt>
          <dd className="capitalize">{status}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Source</dt>
          <dd className="text-right">{source?.source_title ?? "Not recorded"}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Document version</dt>
          <dd>{source?.source_document_version ?? "—"}</dd>
        </div>
        {source && !source.is_verified && (
          <p className="text-xs text-muted-foreground">Wording not yet verified against the source PDF.</p>
        )}
        {minutes && (
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Estimated study time</dt>
            <dd>{minutes}</dd>
          </div>
        )}
      </dl>

      <div className="mt-5">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Exam coverage
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {coverage.map(({ exam, included }) => (
            <li key={exam.id} className="flex items-center justify-between gap-2">
              <span className={included ? "" : "text-muted-foreground"}>{exam.name}</span>
              {included ? (
                <Check className="h-4 w-4 text-primary" />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5 space-y-2">
        <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          PYQs — coming in Phase 04/05
        </div>
        <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Learning resources — coming later
        </div>
        <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
          Repeat analysis — coming later
        </div>
      </div>

      <Button variant="outline" className="mt-5 w-full xl:hidden" onClick={onClose}>
        Close
      </Button>
    </aside>
  );
}
