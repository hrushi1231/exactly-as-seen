import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  browserStrategy,
  directFileStrategy,
  inspectUrl as inspect,
  robotsAllows,
  staticHtmlStrategy,
} from "./collector/strategies.server";

type DB = SupabaseClient<Database>;

async function assertAdmin(supabase: DB, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Administrator access required");
}

async function startRun(supabase: DB, fields: Database["public"]["Tables"]["collection_runs"]["Insert"]) {
  const { data, error } = await supabase.from("collection_runs").insert(fields).select("id").single();
  if (error) throw new Error(error.message);
  return data.id;
}

async function logEvent(
  supabase: DB,
  runId: string,
  level: "info" | "warning" | "error",
  message: string,
  extra: { url?: string; document_id?: string } = {},
) {
  await supabase.from("collection_events").insert({ run_id: runId, level, message, ...extra });
}

async function finishRun(
  supabase: DB,
  runId: string,
  status: "succeeded" | "failed" | "partial" | "requires_worker",
  counts: Partial<Database["public"]["Tables"]["collection_runs"]["Update"]> = {},
) {
  await supabase
    .from("collection_runs")
    .update({ status, finished_at: new Date().toISOString(), ...counts })
    .eq("id", runId);
}

const auth = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);

export const inspectUrl = auth
  .inputValidator((d) => z.object({ url: z.string().url() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const [result, robots] = await Promise.all([inspect(data.url), robotsAllows(data.url)]);
    return { ...result, robotsAllowed: robots.allowed, robotsNote: robots.note };
  });

export const discoverLinks = auth
  .inputValidator((d) =>
    z
      .object({
        url: z.string().url(),
        sourceDomainId: z.string().uuid().nullable(),
        examId: z.string().uuid().nullable(),
        strategy: z.enum(["static_html", "browser"]).default("static_html"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const runId = await startRun(supabase, {
      source_domain_id: data.sourceDomainId,
      target_url: data.url,
      strategy: data.strategy,
      triggered_by: userId,
    });
    try {
      const robots = await robotsAllows(data.url);
      await logEvent(supabase, runId, robots.allowed ? "info" : "warning", robots.note, { url: data.url });
      if (!robots.allowed) {
        await finishRun(supabase, runId, "failed", { errors: 1 });
        return { runId, status: "failed", discovered: 0, newCandidates: 0, message: robots.note };
      }
      const strategy = data.strategy === "browser" ? browserStrategy : staticHtmlStrategy;
      let links;
      try {
        links = await strategy.discover!(data.url);
      } catch (e) {
        const msg = (e as Error).message;
        await logEvent(supabase, runId, "error", msg, { url: data.url });
        const status = data.strategy === "browser" ? "requires_worker" : "failed";
        await finishRun(supabase, runId, status, { errors: 1 });
        return { runId, status, discovered: 0, newCandidates: 0, message: msg };
      }
      let inserted = 0;
      if (links.length) {
        const rows = links.map((l) => ({
          run_id: runId,
          source_domain_id: data.sourceDomainId,
          exam_id: data.examId,
          anchor_text: l.anchorText,
          url: l.url,
          parent_page_url: data.url,
          detected_file_type: l.detectedFileType,
          possible_year: l.possibleYear,
          possible_document_type: l.possibleDocumentType,
          confidence: l.confidence,
        }));
        const { data: ins, error } = await supabase
          .from("candidate_links")
          .upsert(rows, { onConflict: "url,parent_page_url", ignoreDuplicates: true })
          .select("id");
        if (error) throw new Error(error.message);
        inserted = ins?.length ?? 0;
      }
      const msg = `Found ${links.length} document-like links (${inserted} new candidates).`;
      await logEvent(supabase, runId, links.length ? "info" : "warning", msg, { url: data.url });
      await finishRun(supabase, runId, "succeeded", { links_discovered: links.length });
      return { runId, status: "succeeded", discovered: links.length, newCandidates: inserted, message: msg };
    } catch (e) {
      const msg = (e as Error).message;
      await logEvent(supabase, runId, "error", msg, { url: data.url });
      await finishRun(supabase, runId, "failed", { errors: 1 });
      throw new Error(msg);
    }
  });

export const downloadDocument = auth
  .inputValidator((d) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, source_url, source_domain_id, landing_page_url")
      .eq("id", data.documentId)
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
        return { runId, status: "duplicate" as const, message: "Exact duplicate of an existing file" };
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
      return { runId, status: "downloaded" as const, message: "File preserved" };
    } catch (e) {
      return await fail((e as Error).message);
    }
  });
