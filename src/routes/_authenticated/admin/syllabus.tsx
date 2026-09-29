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
  fetchSources,
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
  id?: string | undefined;
  parentId?: string | undefined;
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sourceView, setSourceView] = useState<
    { type: "topic" | "subtopic"; node: Topic | Subtopic; path: string } | null
  >(null);
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

      let payload: Record<string, any> = base;
      if (input.type === "topic") {
        payload = { ...base, estimated_minutes: minutes, subject_id: input.parentId };
      } else if (input.type === "subtopic") {
        payload = { ...base, estimated_minutes: minutes, topic_id: input.parentId };
      }

      const table = TABLES[input.type];
      const query = input.id
        ? supabase.from(table).update(payload as never).eq("id", input.id)
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

  const passesStatus = (n: Topic | Subtopic) => {
    switch (statusFilter) {
      case "all": return true;
      case "missing_wording": return !n.original_syllabus_wording;
      case "missing_page": return n.source_page == null;
      default: return n.verification_status === statusFilter;
    }
  };

  const filtered = tree
    .map(({ subject, topics: entries }) => ({
      subject,
      topics: entries
        .map((e) => ({
          ...e,
          subtopics: statusFilter === "all" ? e.subtopics : e.subtopics.filter(passesStatus),
        }))
        .filter(
        ({ topic, subtopics: subs }) =>
          (matches(topic.name) || subs.some((s) => matches(s['name'])) || matches(subject.name)) &&
          (statusFilter === "all" || passesStatus(topic) || subs.length > 0) &&
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
        exams: (exams.data ?? []).filter((e) => isMapped(e.id, "subject", subject.id)).map((e) => e.slug),
        topics: (topics.data ?? [])
          .filter((t) => t.subject_id === subject.id)
          .map((topic) => ({
            name: topic.name,
            slug: topic.slug,
            description: topic.description,
            source_text: topic.source_text,
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
                source_text: sub.source_text,
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

  type ImportPreview = {
    subjects_create: number;
    subjects_update: number;
    topics_create: number;
    topics_update: number;
    subtopics_create: number;
    subtopics_update: number;
    duplicates: string[];
    invalid_references: string[];
  };
  const [pending, setPending] = useState<{ payload: unknown; preview: ImportPreview } | null>(null);

  const previewImport = useMutation({
    mutationFn: async (file: File) => {
      const payload = JSON.parse(await file.text()) as { subjects?: unknown };
      if (!Array.isArray(payload.subjects)) throw new Error("File must contain a 'subjects' array");
      const { data, error } = await supabase.rpc("import_syllabus" as never, {
        payload,
        do_commit: false,
      } as never);
      if (error) throw new Error((error as { message: string }).message);
      return { payload, preview: data as unknown as ImportPreview };
    },
    onSuccess: (result) => setPending(result),
    onError: (error: Error) => toast.error(error.message),
  });

  const commitImport = useMutation({
    mutationFn: async () => {
      if (!pending) return;
      // Runs as one database transaction: any failure rolls back the whole import.
      const { error } = await supabase.rpc("import_syllabus" as never, {
        payload: pending.payload,
        do_commit: true,
      } as never);
      if (error) throw new Error((error as { message: string }).message);
    },
    onSuccess: () => {
      toast.success("Syllabus imported");
      setPending(null);
      refresh();
      queryClient.invalidateQueries({ queryKey: ["validation"] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
    onError: (error: Error) => toast.error(`Import failed, nothing was changed: ${error.message}`),
  });

  const validation = useQuery({
    queryKey: ["validation", subjects.dataUpdatedAt, topics.dataUpdatedAt, subtopics.dataUpdatedAt, mappings.dataUpdatedAt],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("syllabus_validation" as never);
      if (error) throw new Error((error as { message: string }).message);
      return data as unknown as Record<string, number>;
    },
  });
  const sources = useQuery({ queryKey: ["sources"], queryFn: fetchSources });

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
              if (file) previewImport.mutate(file);
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
          aria-label="Verification filter"
        >
          <option value="all">All verification states</option>
          <option value="verified">Verified</option>
          <option value="unverified">Unverified</option>
          <option value="needs_review">Needs review</option>
          <option value="missing_wording">Missing original wording</option>
          <option value="missing_page">Missing source page</option>
        </select>
      </div>

      <Dialog open={Boolean(sourceView)} onOpenChange={(open) => !open && setSourceView(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Source information</DialogTitle>
          </DialogHeader>
          {sourceView && (() => {
            const n = sourceView.node;
            const src = (sources.data ?? []).find((s) => s.id === n.source_id);
            const pageEnd = "source_page_end" in n ? n.source_page_end : null;
            return (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{sourceView.path}</div>
                  <div className="font-medium">{n.name}</div>
                  <div className="mt-1"><VerificationBadge status={n.verification_status} /></div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Original syllabus wording</div>
                  <blockquote className="mt-1 border-l-2 border-primary/40 pl-3 text-xs leading-relaxed">
                    {n.original_syllabus_wording || "Not recorded"}
                  </blockquote>
                  {n.source_text && <p className="mt-1 text-[11px] text-muted-foreground">{n.source_text}</p>}
                </div>
                <dl className="grid grid-cols-2 gap-y-1">
                  <dt className="text-muted-foreground">Source</dt><dd>{src?.source_title ?? "Not recorded"}</dd>
                  <dt className="text-muted-foreground">Document version</dt><dd>{src?.source_document_version ?? "—"}</dd>
                  <dt className="text-muted-foreground">Page</dt>
                  <dd>{n.source_page ? (pageEnd && pageEnd !== n.source_page ? `${n.source_page}–${pageEnd}` : n.source_page) : "Missing"}</dd>
                  <dt className="text-muted-foreground">Slug</dt><dd className="truncate">{n.slug}</dd>
                </dl>
                {src?.source_url && (
                  <a href={src.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                    Open source document
                  </a>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      <section className="mb-4 rounded-md border border-border bg-card p-3">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Validation summary (live from database)
        </div>
        {validation.data ? (
          <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4 lg:grid-cols-7">
            {[
              ["Subjects", "total_subjects"],
              ["Topics", "total_topics"],
              ["Subtopics", "total_subtopics"],
              ["Unmapped", "unmapped_records"],
              ["Orphans", "orphan_records"],
              ["Duplicate slugs", "duplicate_slugs"],
              ["Missing parents", "missing_parent_references"],
              ["Duplicate names", "duplicate_semantic_nodes"],
              ["Missing source", "missing_source"],
              ["Missing page", "missing_source_page"],
              ["Missing wording", "missing_original_wording"],
              ["Not verified", "needs_review"],
            ].map(([label, key]) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-medium tabular-nums">{validation.data[key!] ?? 0}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">Loading…</p>
        )}
        {(sources.data ?? []).map((src) => (
          <p key={src.id} className="mt-2 text-xs text-muted-foreground">
            Source: {src.source_title}
            {src.source_document_version ? ` · document version ${src.source_document_version}` : ""}
            {src.source_recruitment_context ? ` · ${src.source_recruitment_context}` : ""}
            {src.is_verified ? " · verified" : " · not yet verified"}
          </p>
        ))}
      </section>

      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import preview</DialogTitle>
          </DialogHeader>
          {pending && (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-y-1">
                <dt className="text-muted-foreground">Subjects to create</dt><dd>{pending.preview.subjects_create}</dd>
                <dt className="text-muted-foreground">Topics to create</dt><dd>{pending.preview.topics_create}</dd>
                <dt className="text-muted-foreground">Subtopics to create</dt><dd>{pending.preview.subtopics_create}</dd>
                <dt className="text-muted-foreground">Records to update</dt>
                <dd>{pending.preview.subjects_update + pending.preview.topics_update + pending.preview.subtopics_update}</dd>
                <dt className="text-muted-foreground">Duplicates detected</dt><dd>{pending.preview.duplicates.length}</dd>
                <dt className="text-muted-foreground">Invalid references</dt><dd>{pending.preview.invalid_references.length}</dd>
              </dl>
              {[...pending.preview.duplicates, ...pending.preview.invalid_references].length > 0 && (
                <ul className="max-h-40 overflow-auto rounded border border-border p-2 text-xs text-muted-foreground">
                  {[...pending.preview.duplicates, ...pending.preview.invalid_references].map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">
                Duplicates and invalid entries are skipped. The import runs all-or-nothing.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Cancel</Button>
            <Button onClick={() => commitImport.mutate()} disabled={commitImport.isPending}>
              {commitImport.isPending ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                          <span className="min-w-0 flex-1 truncate text-sm" title={topic.original_syllabus_wording ?? undefined}>{topic.name}</span>
                          <SourceMeta node={topic} onOpen={() => setSourceView({ type: "topic", node: topic, path: subject.name })} />
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
                                  <span className="min-w-0 flex-1 truncate text-sm" title={sub.original_syllabus_wording ?? undefined}>
                                    {sub.name}
                                  </span>
                                  <SourceMeta node={sub} onOpen={() => setSourceView({ type: "subtopic", node: sub, path: `${subject.name} › ${topic.name}` })} />
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
