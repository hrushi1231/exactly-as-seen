import { supabase } from "@/integrations/supabase/client";

export type EntityType = "subject" | "topic" | "subtopic";

export interface Exam {
  id: string;
  name: string;
  slug: string;
  organization: string | null;
  post_name: string | null;
  subject_name: string | null;
  is_primary: boolean;
  status: string;
  display_order: number;
}

export interface Subject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  status: string;
}

export interface Topic {
  id: string;
  subject_id: string;
  parent_topic_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  estimated_minutes: number | null;
  status: string;
}

export interface Subtopic {
  id: string;
  topic_id: string;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  estimated_minutes: number | null;
  status: string;
}

export interface Mapping {
  id: string;
  exam_id: string;
  entity_type: EntityType;
  entity_id: string;
  is_included: boolean;
}

export interface Progress {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  status: string;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function formatMinutes(minutes: number | null | undefined) {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>) {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return (data ?? []) as T;
}

export const fetchExams = () =>
  unwrap<Exam[]>(
    supabase.from("exams").select("*").order("display_order").order("name").returns<Exam[]>(),
  );

export const fetchSubjects = () =>
  unwrap<Subject[]>(
    supabase.from("subjects").select("*").order("display_order").order("name").returns<Subject[]>(),
  );

export const fetchTopics = () =>
  unwrap<Topic[]>(
    supabase.from("topics").select("*").order("display_order").order("name").returns<Topic[]>(),
  );

export const fetchSubtopics = () =>
  unwrap<Subtopic[]>(
    supabase
      .from("subtopics")
      .select("*")
      .order("display_order")
      .order("name")
      .returns<Subtopic[]>(),
  );

export const fetchMappings = () =>
  unwrap<Mapping[]>(
    supabase
      .from("exam_syllabus_mapping")
      .select("id, exam_id, entity_type, entity_id, is_included")
      .returns<Mapping[]>(),
  );

export const fetchProgress = async (userId: string) =>
  unwrap<Progress[]>(
    supabase
      .from("user_topic_progress")
      .select("id, entity_type, entity_id, status")
      .eq("user_id", userId)
      .returns<Progress[]>(),
  );

export async function setProgress(
  userId: string,
  entityType: EntityType,
  entityId: string,
  completed: boolean,
) {
  const { error } = await supabase.from("user_topic_progress").upsert(
    {
      user_id: userId,
      entity_type: entityType,
      entity_id: entityId,
      status: completed ? "completed" : "not_started",
      completed_at: completed ? new Date().toISOString() : null,
    },
    { onConflict: "user_id,entity_type,entity_id" },
  );
  if (error) throw new Error(error.message);
}

export interface SyllabusTree {
  subjects: Array<
    Subject & {
      topics: Array<Topic & { subtopics: Subtopic[]; children: Topic[] }>;
    }
  >;
}

export function buildTree(subjects: Subject[], topics: Topic[], subtopics: Subtopic[]) {
  return subjects.map((subject) => ({
    ...subject,
    topics: topics
      .filter((t) => t.subject_id === subject.id && !t.parent_topic_id)
      .map((topic) => ({
        ...topic,
        subtopics: subtopics.filter((s) => s.topic_id === topic.id),
        children: topics.filter((t) => t.parent_topic_id === topic.id),
      })),
  }));
}

export function mappedExamIds(mappings: Mapping[], entityType: EntityType, entityId: string) {
  return mappings
    .filter((m) => m.entity_type === entityType && m.entity_id === entityId && m.is_included)
    .map((m) => m.exam_id);
}
