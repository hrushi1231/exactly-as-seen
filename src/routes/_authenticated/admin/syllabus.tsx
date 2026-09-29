import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Pencil,
  Plus,
  Trash2,
  Upload,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchExams,
  fetchMappings,
  fetchSubjects,
  fetchSubtopics,
  fetchTopics,
  slugify,
  type EntityType,
  type Subject,
  type Subtopic,
  type Topic,
} from "@/lib/syllabus";

export const Route = createFileRoute("/_authenticated/admin/syllabus")({
  head: () => ({
    meta: [
      { title: "Syllabus — PGT CS Workbench" },
      {
        name: "description",
        content: "Manage subjects, topics and subtopics and map them to examinations.",
      },
      { property: "og:title", content: "Syllabus — PGT CS Workbench" },
      {
        property: "og:description",
        content: "Manage subjects, topics and subtopics and map them to examinations.",
      },
    ],
  }),
  component: SyllabusAdmin,
});

type Draft = {
  type: EntityType;
  id?: string;
  parentId?: string;
  name: string;
  slug: string;
  description: string;
  estimated_minutes: string;
  status: string;
  display_order: number;
};

const TABLES: Record<EntityType, "subjects" | "topics" | "subtopics"> = {
  subject: "subjects",
  topic: "topics",
  subtopic: "subtopics",
};

function SyllabusAdmin() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<{ type: EntityType; id: string; name: string } | null>(
    null,
  );
  const [search, setSearch] = useState("");
  const [examFilter, setExamFilter] = useState<string>("all");
  const fileRef = useRef<HTMLInputElement>(null);

  const exams = useQuery({ queryKey: ["exams"], queryFn: fetchExams });
  const subjects = useQuery({ queryKey: ["subjects"], queryFn: fetchSubjects });
  const topics = useQuery({ queryKey: ["topics"], queryFn: fetchTopics });
  const subtopics = useQuery({ queryKey: ["subtopics"], queryFn: fetchSubtopics });
  const mappings = useQuery({ queryKey: ["mappings"], queryFn: fetchMappings });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["subjects"] });
    queryClient.invalidateQueries({ queryKey: ["topics"] });
    queryClient.invalidateQueries({ queryKey: ["subtopics"] });
    queryClient.invalidateQueries({ queryKey: ["mappings"] });
  };

  const save = useMutation({
    mutationFn: async (input: Draft) => {
      const name = input.name.trim();
      if (!name) throw new Error("Name is required");
      const base = {
        name,
        slug: input.slug.trim() || slugify(name),
        description: input.description.trim() || null,
        status: input.status,
        display_order: Number(input.display_order) || 0,
      };
      const minutes = input.estimated_minutes.trim()
        ? Number(input.estimated_minutes)
        : null;

      let payload: Record<string, unknown> = base;
      if (input.type === "topic") {
        payload = { ...base, estimated_minutes: minutes, subject_id: input.parentId };
      } else if (input.type === "subtopic") {
        payload = { ...base, estimated_minutes: minutes, topic_id: input.parentId };
      }

      const table = TABLES[input.type];
      const query = input.id
        ? supabase.from(table).update(payload).eq("id", input.id)
        : supabase.from(table).insert(payload as never);
      const { error } = await query;
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Saved");
      setDraft(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (target: { type: EntityType; id: string }) => {
      const { error } = await supabase.from(TABLES[target.type]).delete().eq("id", target.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Deleted");
      setDeleting(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: async (input: {
      type: EntityType;
      rows: Array<{ id: string; display_order: number }>;
    }) => {
      for (const row of input.rows) {
        const { error } = await supabase
          .from(TABLES[input.type])
          .update({ display_order: row.display_order })
          .eq("id", row.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: refresh,
    onError: (error: Error) => toast.error(error.message),
  });

  const toggleMapping = useMutation({
    mutationFn: async (input: {
      examId: string;
      type: EntityType;
      entityId: string;
      include: boolean;
    }) => {
      const { error } = await supabase.from("exam_syllabus_mapping").upsert(
        {
          exam_id: input.examId,
          entity_type: input.type,
          entity_id: input.entityId,
          is_included: input.include,
        },
        { onConflict: "exam_id,entity_type,entity_id" },
      );
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mappings"] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const isMapped = (examId: string, type: EntityType, entityId: string) =>
    (mappings.data ?? []).some(
      (m) =>
        m.exam_id === examId && m.entity_type === type && m.entity_id === entityId && m.is_included,
    );

  const term = search.trim().toLowerCase();
  const matches = (name: string) => !term || name.toLowerCase().includes(term);
  const passesExam = (type: EntityType, id: string) =>
    examFilter === "all" || isMapped(examFilter, type, id);

  const tree = useMemo(() => {
    const allTopics = topics.data ?? [];
    const allSubtopics = subtopics.data ?? [];
    return (subjects.data ?? []).map((subject) => ({
      subject,
      topics: allTopics
        .filter((t) => t.subject_id === subject.id)
        .map((topic) => ({
          topic,
          subtopics: allSubtopics.filter((s) => s.topic_id === topic.id),
        })),
    }));
  }, [subjects.data, topics.data, subtopics.data]);

  const filtered = tree
    .map(({ subject, topics: entries }) => ({
      subject,
      topics: entries.filter(
        ({ topic, subtopics: subs }) =>
          (matches(topic.name) || subs.some((s) => matches(s.name)) || matches(subject.name)) &&
          (examFilter === "all" ||
            passesExam("topic", topic.id) ||
            subs.some((s) => passesExam("subtopic", s.id))),
      ),
    }))
    .filter(
      ({ subject, topics: entries }) =>
        entries.length > 0 ||
        ((matches(subject.name) || !term) &&
          (examFilter === "all" || passesExam("subject", subject.id))),
    );

  function exportJson() {
    const data = {
      subjects: (subjects.data ?? []).map((subject) => ({
        name: subject.name,
        slug: subject.slug,
        description: subject.description,
        display_order: subject.display_order,
        status: subject.status,
        topics: (topics.data ?? [])
          .filter((t) => t.subject_id === subject.id)
          .map((topic) => ({
            name: topic.name,
            slug: topic.slug,
            description: topic.description,
            display_order: topic.display_order,
            estimated_minutes: topic.estimated_minutes,
            status: topic.status,
            exams: (exams.data ?? [])
              .filter((e) => isMapped(e.id, "topic", topic.id))
              .map((e) => e.slug),
            subtopics: (subtopics.data ?? [])
              .filter((s) => s.topic_id === topic.id)
              .map((sub) => ({
                name: sub.name,
                slug: sub.slug,
                description: sub.description,
                display_order: sub.display_order,
                estimated_minutes: sub.estimated_minutes,
                status: sub.status,
                exams: (exams.data ?? [])
                  .filter((e) => isMapped(e.id, "subtopic", sub.id))
                  .map((e) => e.slug),
              })),
          })),
      })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "syllabus.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  const importJson = useMutation({
    mutationFn: async (file: File) => {
      const parsed = JSON.parse(await file.text()) as {
        subjects?: Array<Record<string, unknown>>;
      };
      if (!Array.isArray(parsed.subjects)) throw new Error("File must contain a 'subjects' array");
      const examBySlug = new Map((exams.data ?? []).map((e) => [e.slug, e.id]));

      for (const [si, rawSubject] of parsed.subjects.entries()) {
        const s = rawSubject as Record<string, any>;
        const subjectRow = {
          name: String(s.name ?? "").trim(),
          slug: String(s.slug ?? slugify(String(s.name ?? ""))),
          description: s.description ?? null,
          display_order: Number(s.display_order ?? si),
          status: String(s.status ?? "active"),
        };
        if (!subjectRow.name) continue;
        const { data: subject, error: subjectError } = await supabase
          .from("subjects")
          .upsert(subjectRow, { onConflict: "slug" })
          .select("id")
          .single();
        if (subjectError) throw new Error(subjectError.message);

        for (const [ti, rawTopic] of ((s.topics ?? []) as any[]).entries()) {
          const topicRow = {
            subject_id: subject.id,
            name: String(rawTopic.name ?? "").trim(),
            slug: String(rawTopic.slug ?? slugify(String(rawTopic.name ?? ""))),
            description: rawTopic.description ?? null,
            display_order: Number(rawTopic.display_order ?? ti),
            estimated_minutes: rawTopic.estimated_minutes ?? null,
            status: String(rawTopic.status ?? "active"),
          };
          if (!topicRow.name) continue;
          const { data: topic, error: topicError } = await supabase
            .from("topics")
            .upsert(topicRow, { onConflict: "subject_id,slug" })
            .select("id")
            .single();
          if (topicError) throw new Error(topicError.message);

          for (const examSlug of (rawTopic.exams ?? []) as string[]) {
            const examId = examBySlug.get(examSlug);
            if (!examId) continue;
            await supabase.from("exam_syllabus_mapping").upsert(
              {
                exam_id: examId,
                entity_type: "topic",
                entity_id: topic.id,
                is_included: true,
              },
              { onConflict: "exam_id,entity_type,entity_id" },
            );
          }

          for (const [ui, rawSub] of ((rawTopic.subtopics ?? []) as any[]).entries()) {
            const subRow = {
              topic_id: topic.id,
              name: String(rawSub.name ?? "").trim(),
              slug: String(rawSub.slug ?? slugify(String(rawSub.name ?? ""))),
              description: rawSub.description ?? null,
              display_order: Number(rawSub.display_order ?? ui),
              estimated_minutes: rawSub.estimated_minutes ?? null,
              status: String(rawSub.status ?? "active"),
            };
            if (!subRow.name) continue;
            const { data: sub, error: subError } = await supabase
              .from("subtopics")
              .upsert(subRow, { onConflict: "topic_id,slug" })
              .select("id")
              .single();
            if (subError) throw new Error(subError.message);

            for (const examSlug of (rawSub.exams ?? []) as string[]) {
              const examId = examBySlug.get(examSlug);
              if (!examId) continue;
              await supabase.from("exam_syllabus_mapping").upsert(
                {
                  exam_id: examId,
                  entity_type: "subtopic",
                  entity_id: sub.id,
                  is_included: true,
                },
                { onConflict: "exam_id,entity_type,entity_id" },
              );
            }
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("Syllabus imported");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function move(type: EntityType, list: Array<{ id: string }>, index: number, delta: number) {
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    const ordered = [...list];
    const [item] = ordered.splice(index, 1);
    ordered.splice(next, 0, item!);
    reorder.mutate({
      type,
      rows: ordered.map((row, i) => ({ id: row.id, display_order: i })),
    });
  }

  function newDraft(type: EntityType, parentId?: string, order = 0): Draft {
    return {
      type,
      parentId,
      name: "",
      slug: "",
      description: "",
      estimated_minutes: "",
      status: "active",
      display_order: order,
    };
  }

  function editDraft(type: EntityType, row: Subject | Topic | Subtopic, parentId?: string): Draft {
    return {
      type,
      id: row.id,
      parentId,
      name: row.name,
      slug: row.slug,
      description: row.description ?? "",
      estimated_minutes:
        "estimated_minutes" in row && row.estimated_minutes ? String(row.estimated_minutes) : "",
      status: row.status,
      display_order: row.display_order,
    };
  }

  function MappingRow({ type, id }: { type: EntityType; id: string }) {
    return (
      <div className="flex flex-wrap items-center gap-2.5">
        {(exams.data ?? []).map((exam) => (
          <label key={exam.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              className="h-3 w-3 accent-[var(--primary)]"
              checked={isMapped(exam.id, type, id)}
              onChange={(e) =>
                toggleMapping.mutate({
                  examId: exam.id,
                  type,
                  entityId: id,
                  include: e.target.checked,
                })
              }
            />
            {exam.name}
          </label>
        ))}
      </div>
    );
  }

  const loading = subjects.isLoading || topics.isLoading || subtopics.isLoading;

  return (
    <AppShell
      title="Syllabus"
      description="Subjects, topics, subtopics and exam mapping"
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportJson}>
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) importJson.mutate(file);
              e.target.value = "";
            }}
          />
          <Button size="sm" onClick={() => setDraft(newDraft("subject", undefined, tree.length))}>
            <Plus className="mr-1.5 h-4 w-4" /> Subject
          </Button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search subjects, topics, subtopics"
          className="w-full sm:w-72"
        />
        <select
          value={examFilter}
          onChange={(e) => setExamFilter(e.target.value)}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        >
          <option value="all">All exams</option>
          {(exams.data ?? []).map((exam) => (
            <option key={exam.id} value={exam.id}>
              {exam.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading syllabus…</p>}

      {!loading && filtered.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-card px-6 py-12 text-center">
          <h2 className="text-sm font-semibold">No subjects yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Create a subject, or import a syllabus JSON file to populate the structure.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {filtered.map(({ subject, topics: entries }, subjectIndex) => {
          const open = expanded[subject.id] ?? true;
          return (
            <div key={subject.id} className="rounded-md border border-border bg-card">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  className="rounded p-0.5 text-muted-foreground hover:bg-secondary"
                  onClick={() => setExpanded((s) => ({ ...s, [subject.id]: !open }))}
                  aria-label="Toggle subject"
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <span className="text-sm font-semibold">{subject.name}</span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                    onClick={() =>
                      move(
                        "subject",
                        filtered.map((f) => f.subject),
                        subjectIndex,
                        -1,
                      )
                    }
                    aria-label="Move subject up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                    onClick={() =>
                      move(
                        "subject",
                        filtered.map((f) => f.subject),
                        subjectIndex,
                        1,
                      )
                    }
                    aria-label="Move subject down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                    onClick={() => setDraft(editDraft("subject", subject))}
                    aria-label="Edit subject"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                    onClick={() =>
                      setDeleting({ type: "subject", id: subject.id, name: subject.name })
                    }
                    aria-label="Delete subject"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDraft(newDraft("topic", subject.id, entries.length))}
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" /> Topic
                  </Button>
                </div>
              </div>

              {open && (
                <div className="border-t border-border">
                  <div className="px-4 py-2">
                    <MappingRow type="subject" id={subject.id} />
                  </div>
                  {entries.length === 0 && (
                    <p className="px-4 pb-3 text-xs text-muted-foreground">No topics yet.</p>
                  )}
                  {entries.map(({ topic, subtopics: subs }, topicIndex) => {
                    const topicOpen = expanded[topic.id] ?? false;
                    return (
                      <div key={topic.id} className="border-t border-border">
                        <div className="flex items-center gap-2 px-3 py-2 pl-6">
                          <button
                            className="rounded p-0.5 text-muted-foreground hover:bg-secondary"
                            onClick={() => setExpanded((s) => ({ ...s, [topic.id]: !topicOpen }))}
                            aria-label="Toggle topic"
                          >
                            {topicOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <span className="min-w-0 flex-1 truncate text-sm">{topic.name}</span>
                          <div className="flex items-center gap-1">
                            <button
                              className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                              onClick={() =>
                                move(
                                  "topic",
                                  entries.map((e) => e.topic),
                                  topicIndex,
                                  -1,
                                )
                              }
                              aria-label="Move topic up"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                              onClick={() =>
                                move(
                                  "topic",
                                  entries.map((e) => e.topic),
                                  topicIndex,
                                  1,
                                )
                              }
                              aria-label="Move topic down"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                              onClick={() => setDraft(editDraft("topic", topic, subject.id))}
                              aria-label="Edit topic"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                              onClick={() =>
                                setDeleting({ type: "topic", id: topic.id, name: topic.name })
                              }
                              aria-label="Delete topic"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setDraft(newDraft("subtopic", topic.id, subs.length))
                              }
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" /> Subtopic
                            </Button>
                          </div>
                        </div>

                        {topicOpen && (
                          <div className="space-y-2 px-4 pb-3 pl-12">
                            <MappingRow type="topic" id={topic.id} />
                            {subs.length === 0 && (
                              <p className="text-xs text-muted-foreground">No subtopics yet.</p>
                            )}
                            {subs.map((sub, subIndex) => (
                              <div key={sub.id} className="rounded-md border border-border p-2">
                                <div className="flex items-center gap-2">
                                  <span className="min-w-0 flex-1 truncate text-sm">
                                    {sub.name}
                                  </span>
                                  <button
                                    className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                                    onClick={() => move("subtopic", subs, subIndex, -1)}
                                    aria-label="Move subtopic up"
                                  >
                                    <ArrowUp className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                                    onClick={() => move("subtopic", subs, subIndex, 1)}
                                    aria-label="Move subtopic down"
                                  >
                                    <ArrowDown className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    className="rounded p-1.5 text-muted-foreground hover:bg-secondary"
                                    onClick={() =>
                                      setDraft(editDraft("subtopic", sub, topic.id))
                                    }
                                    aria-label="Edit subtopic"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                                    onClick={() =>
                                      setDeleting({
                                        type: "subtopic",
                                        id: sub.id,
                                        name: sub.name,
                                      })
                                    }
                                    aria-label="Delete subtopic"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <div className="mt-1.5">
                                  <MappingRow type="subtopic" id={sub.id} />
                                </div>
                              </div>
                            ))}
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

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {draft?.id ? "Edit" : "New"} {draft?.type}
            </DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="e-name">Name</Label>
                <Input
                  id="e-name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      name: e.target.value,
                      slug: draft.id ? draft.slug : slugify(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-slug">Slug</Label>
                <Input
                  id="e-slug"
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="e-desc">Description</Label>
                <Textarea
                  id="e-desc"
                  rows={3}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              {draft.type !== "subject" && (
                <div className="space-y-1.5">
                  <Label htmlFor="e-min">Estimated minutes</Label>
                  <Input
                    id="e-min"
                    type="number"
                    value={draft.estimated_minutes}
                    onChange={(e) => setDraft({ ...draft, estimated_minutes: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={() => draft && save.mutate(draft)} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Everything nested under it and its exam mappings will be removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && remove.mutate(deleting)}
              disabled={remove.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
