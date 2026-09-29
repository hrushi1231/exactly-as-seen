// Shared download pipeline (robots check, SHA-256 dedup, storage, provenance).
// Server-only; callers must already have verified the admin role.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { directFileStrategy, robotsAllows } from "./strategies.server";

type DB = SupabaseClient<Database>;

async function startRun(supabase: DB, fields: Database["public"]["Tables"]["collection_runs"]["Insert"]) {
  const { data, error } = await supabase.from("collection_runs").insert(fields).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}
async function logEvent(supabase: DB, runId: string, level: "info" | "warning" | "error", message: string, extra: { url?: string; document_id?: string } = {}) {
  await supabase.from("collection_events").insert({ run_id: runId, level, message, ...extra });
}
async function finishRun(supabase: DB, runId: string, status: "succeeded" | "failed" | "partial" | "requires_worker", counts: Partial<Database["public"]["Tables"]["collection_runs"]["Update"]> = {}) {
  await supabase.from("collection_runs").update({ status, finished_at: new Date().toISOString(), ...counts }).eq("id", runId);
}

export interface DownloadOutcome {
  runId: string;
  status: "failed" | "duplicate" | "downloaded";
  message: string;
  bytes?: Uint8Array;
  mimeType?: string;
}

export async function downloadDocumentCore(supabase: DB, userId: string, documentId: string): Promise<DownloadOutcome> {
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, source_url, source_domain_id, landing_page_url")
      .eq("id", documentId)
      .single();
    if (docErr) throw new Error(docErr.message);

    const runId = await startRun(supabase, {
      source_domain_id: doc.source_domain_id,
      document_id: doc.id,
      target_url: doc.source_url,
      strategy: "direct_file",
      triggered_by: userId,
    });
    const fail = async (msg: string) => {
      await logEvent(supabase, runId, "error", msg, { url: doc.source_url, document_id: doc.id });
      await supabase
        .from("documents")
        .update({ download_status: "failed" })
        .eq("id", doc.id);
      await finishRun(supabase, runId, "failed", { errors: 1 });
      return { runId, status: "failed" as const, message: msg };
    };

    try {
      const robots = await robotsAllows(doc.source_url);
      await logEvent(supabase, runId, robots.allowed ? "info" : "warning", robots.note, { url: doc.source_url });
      if (!robots.allowed) return await fail(robots.note);

      const file = await directFileStrategy.download!(doc.source_url);
      await logEvent(supabase, runId, "info", `Downloaded ${file.fileSize} bytes (${file.mimeType}); SHA-256 ${file.sha256}`, {
        url: file.finalUrl,
        document_id: doc.id,
      });

      const { data: existing } = await supabase
        .from("document_files")
        .select("id, document_id")
        .eq("sha256", file.sha256)
        .maybeSingle();

      if (existing && existing.document_id !== doc.id) {
        // Exact same bytes already preserved: keep one physical copy, add provenance.
        await supabase.from("document_provenance").upsert(
          {
            document_id: existing.document_id,
            source_domain_id: doc.source_domain_id,
            url: doc.source_url,
            landing_page_url: doc.landing_page_url,
            notes: `Identical file (SHA-256 match) found via document ${doc.id}`,
          },
          { onConflict: "document_id,url", ignoreDuplicates: true },
        );
        await supabase
          .from("documents")
          .update({
            download_status: "skipped",
            sha256: file.sha256,
            mime_type: file.mimeType,
            file_size: file.fileSize,
            duplicate_of_document_id: existing.document_id,
            downloaded_at: new Date().toISOString(),
          })
          .eq("id", doc.id);
        await logEvent(supabase, runId, "warning", "Exact duplicate of an already preserved file; no second copy stored.", {
          document_id: existing.document_id,
        });
        await finishRun(supabase, runId, "succeeded", { duplicates_detected: 1, documents_updated: 2 });
        return { runId, status: "duplicate" as const, message: "Exact duplicate of an existing file", bytes: file.bytes, mimeType: file.mimeType };
      }

      if (!existing) {
        const ext = (file.filename.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? "bin").toLowerCase();
        const path = `${file.sha256.slice(0, 2)}/${file.sha256}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("source-documents")
          .upload(path, file.bytes, { contentType: file.mimeType, upsert: false });
        if (upErr && !/exists/i.test(upErr.message)) return await fail(`Storage upload failed: ${upErr.message}`);
        const { error: fErr } = await supabase.from("document_files").insert({
          document_id: doc.id,
          original_filename: file.filename,
          storage_path: path,
          mime_type: file.mimeType,
          sha256: file.sha256,
          file_size: file.fileSize,
          page_count: file.pageCount,
        });
        if (fErr) return await fail(fErr.message);
      }

      await supabase.from("document_provenance").upsert(
        { document_id: doc.id, source_domain_id: doc.source_domain_id, url: doc.source_url, landing_page_url: doc.landing_page_url },
        { onConflict: "document_id,url", ignoreDuplicates: true },
      );
      await supabase
        .from("documents")
        .update({
          download_status: "downloaded",
          sha256: file.sha256,
          mime_type: file.mimeType,
          file_size: file.fileSize,
          downloaded_at: new Date().toISOString(),
        })
        .eq("id", doc.id);
      await finishRun(supabase, runId, "succeeded", { files_downloaded: existing ? 0 : 1, documents_updated: 1 });
      return { runId, status: "downloaded" as const, message: "File preserved", bytes: file.bytes, mimeType: file.mimeType };
    } catch (e) {
      return await fail((e as Error).message);
    }
}
