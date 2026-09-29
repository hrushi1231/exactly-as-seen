import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  browserStrategy,
  inspectUrl as inspect,
  robotsAllows,
  staticHtmlStrategy,
} from "./collector/strategies.server";
import { downloadDocumentCore } from "./collector/core.server";

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
    await assertAdmin(context.supabase, context.userId);
    const r = await downloadDocumentCore(context.supabase, context.userId, data.documentId);
    return { runId: r.runId, status: r.status, message: r.message };
  });
