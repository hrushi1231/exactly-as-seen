import type { Database } from "@/integrations/supabase/types";

export type SourceDomain = Database["public"]["Tables"]["source_domains"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type DocumentFile = Database["public"]["Tables"]["document_files"]["Row"];
export type CandidateLink = Database["public"]["Tables"]["candidate_links"]["Row"];
export type CollectionRun = Database["public"]["Tables"]["collection_runs"]["Row"];
export type CollectionEvent = Database["public"]["Tables"]["collection_events"]["Row"];

export const AUTHORITY_LEVELS = ["official", "secondary", "memory_based", "unknown"] as const;
export const AUTHORITY_LABEL: Record<string, string> = {
  official: "Official",
  secondary: "Secondary",
  memory_based: "Memory-based",
  unknown: "Unknown",
};
export const DOCUMENT_TYPES = [
  "syllabus",
  "question_paper",
  "answer_key",
  "response_sheet",
  "notification",
  "exam_pattern",
  "memory_based_paper",
  "other",
] as const;
export const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  syllabus: "Syllabus",
  question_paper: "Question paper",
  answer_key: "Answer key",
  response_sheet: "Response sheet",
  notification: "Notification",
  exam_pattern: "Exam pattern",
  memory_based_paper: "Memory-based paper",
  other: "Other",
};
export const VERIFICATION = ["unverified", "verified", "needs_review"] as const;
export const VERIFICATION_LABEL: Record<string, string> = {
  unverified: "Unverified",
  verified: "Verified",
  needs_review: "Needs review",
};
export const DOWNLOAD_STATUSES = ["discovered", "queued", "downloaded", "failed", "skipped"] as const;
export const DOWNLOAD_LABEL: Record<string, string> = {
  discovered: "Discovered",
  queued: "Queued",
  downloaded: "Downloaded",
  failed: "Failed",
  skipped: "Skipped (duplicate)",
};

export function authorityClass(level: string) {
  switch (level) {
    case "official":
      return "border-primary/30 bg-primary/10 text-primary";
    case "secondary":
      return "border-border bg-secondary text-foreground";
    case "memory_based":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export function formatBytes(n: number | null | undefined) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function formatDate(s: string | null | undefined) {
  return s ? new Date(s).toLocaleString() : "—";
}

export const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";
