import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import {
  canonicalizeUrl,
  classify,
  FirecrawlDiscoveryProvider,
  planQueries,
  type DiscoveryProvider,
  type PostType,
} from "./discovery/providers.server";

type DB = SupabaseClient<Database>;

async function assertAdmin(supabase: DB, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Administrator access required");
}

const auth = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);

async function recomputeCycle(supabase: DB, cycleId: string, post: PostType, year: number) {
  const { data: cands } = await supabase
    .from("discovery_candidates")
    .select("artifact_type_guess, authority_guess, source_kind, year_guess, post_type_guess, status")
    .contains("cycle_ids", [cycleId])
    .neq("status", "ignored");
  const all = cands ?? [];
  const match = all.filter((c) => c.year_guess === year && (c.post_type_guess === post || c.post_type_guess === "unknown"));
  // Paper/key/sheet flags need an admin-approved lead; unreviewed search hits are
  // often generic listing pages, so they only count as "exam held" evidence.
  const confirmed = match.filter((c) => c.status === "approved" || c.status === "sent");
  const has = (t: string) => confirmed.some((c) => c.artifact_type_guess === t);
  const mentions = (t: string) => match.some((c) => c.artifact_type_guess === t);
  const paper = has("question_paper");
  const memOnly = !paper && (has("question_video") || has("memory_based_questions") || has("solved_questions"));
  const held = ["answer_key", "response_sheet", "result", "cutoff", "exam_schedule", "exam_notice", "question_paper"].some(mentions);
  const evidence = paper ? "paper_found" : memOnly ? "memory_based_only" : held ? "exam_held_paper_not_found" : match.length ? "unknown" : "no_exam_evidence";
  return {
    candidate_count: all.length,
    official_candidates: all.filter((c) => c.authority_guess === "official").length,
    secondary_candidates: all.filter((c) => c.authority_guess !== "official" && c.source_kind !== "youtube").length,
    video_candidates: all.filter((c) => c.source_kind === "youtube").length,
    paper_found: paper,
    answer_key_found: has("answer_key"),
    response_sheet_found: has("response_sheet"),
    evidence_status: evidence,
  };
}

export const runCycleDiscovery = auth
  .inputValidator((d) => z.object({ cycleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: cycle, error } = await supabase
      .from("pyq_research_cycles")
      .select("id, exam_id, post_type, year, queries_run")
      .eq("id", data.cycleId)
      .single();
    if (error) throw new Error(error.message);
    const post = cycle.post_type as PostType;
    await supabase.from("pyq_research_cycles").update({ search_status: "searching" }).eq("id", cycle.id);

    const provider: DiscoveryProvider = new FirecrawlDiscoveryProvider();
    const planned = planQueries(post, cycle.year);
    const results: { query: string; kind: string; hits: Awaited<ReturnType<DiscoveryProvider["search"]>>; error?: string }[] = [];
    // Serial with a short gap; Firecrawl plans are rate limited per minute.
    for (const p of planned) {
      let attempt = 0;
      for (;;) {
        try {
          results.push({ ...p, hits: await provider.search(p.query, { limit: 10 }) });
          break;
        } catch (e) {
          const msg = (e as Error).message;
          if (/\[429\]/.test(msg) && attempt < 2) {
            attempt++;
            await new Promise((r) => setTimeout(r, 30_000));
            continue;
          }
          results.push({ ...p, hits: [], error: msg });
          break;
        }
      }
      await new Promise((r) => setTimeout(r, 1200));
    }

    await supabase.from("discovery_queries").insert(
      results.map((r) => ({
        cycle_id: cycle.id,
        provider: provider.name,
        query: r.query,
        query_kind: r.kind,
        result_count: r.hits.length,
        error: r.error ?? null,
      })),
    );

    // Deduplicate by canonical URL, keep every query that found it.
    const byUrl = new Map<string, { hit: (typeof results)[number]["hits"][number]; queries: Set<string> }>();
    for (const r of results)
      for (const h of r.hits) {
        let key: string;
        try { key = canonicalizeUrl(h.url); } catch { continue; }
        const e = byUrl.get(key) ?? { hit: h, queries: new Set<string>() };
        e.queries.add(r.query);
        byUrl.set(key, e);
      }

    const keys = [...byUrl.keys()];
    const existing = new Map<string, { id: string; discovery_queries: string[]; cycle_ids: string[] }>();
    for (let i = 0; i < keys.length; i += 100) {
      const { data: ex } = await supabase
        .from("discovery_candidates")
        .select("id, canonical_url, discovery_queries, cycle_ids")
        .in("canonical_url", keys.slice(i, i + 100));
      for (const r of ex ?? []) existing.set(r.canonical_url, r);
    }

    let added = 0, skippedIrrelevant = 0;
    const inserts: Database["public"]["Tables"]["discovery_candidates"]["Insert"][] = [];
    for (const [key, { hit, queries }] of byUrl) {
      const ex = existing.get(key);
      if (ex) {
        await supabase
          .from("discovery_candidates")
          .update({
            discovery_queries: [...new Set([...ex.discovery_queries, ...queries])],
            cycle_ids: [...new Set([...ex.cycle_ids, cycle.id])],
          })
          .eq("id", ex.id);
        continue;
      }
      const c = classify(hit, cycle.year);
      if (!c.relevant) { skippedIrrelevant++; continue; }
      inserts.push({
        canonical_url: key,
        url: hit.url,
        title: hit.title,
        snippet: hit.snippet,
        source_domain: c.sourceDomain,
        source_kind: c.sourceKind,
        exam_id: cycle.exam_id,
        post_type_guess: c.postTypeGuess,
        year_guess: c.yearGuess,
        artifact_type_guess: c.artifactTypeGuess,
        authority_guess: c.authorityGuess,
        confidence: c.confidence,
        is_downloadable: c.isDownloadable,
        discovery_queries: [...queries],
        cycle_ids: [cycle.id],
        provider: provider.name,
      });
    }
    if (inserts.length) {
      const { error: insErr } = await supabase.from("discovery_candidates").insert(inserts);
      if (insErr) throw new Error(insErr.message);
      added = inserts.length;
    }

    const stats = await recomputeCycle(supabase, cycle.id, post, cycle.year);
    const failed = results.filter((r) => r.error).length;
    await supabase
      .from("pyq_research_cycles")
      .update({
        ...stats,
        // If every search failed we learned nothing: keep evidence unknown.
        ...(failed === results.length ? { evidence_status: "unknown" } : {}),
        queries_run: cycle.queries_run + results.length,
        // One automated pass is never "exhaustive"; an admin confirms that.
        search_status: failed ? "partial" : "needs_review",
        last_searched_at: new Date().toISOString(),
      })
      .eq("id", cycle.id);

    return {
      queries: results.length,
      failedQueries: failed,
      firstError: results.find((r) => r.error)?.error ?? null,
      uniqueResults: byUrl.size,
      added,
      skippedIrrelevant,
    };
  });

export const refreshCycleStats = auth
  .inputValidator((d) => z.object({ cycleId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: c } = await context.supabase.from("pyq_research_cycles").select("post_type, year").eq("id", data.cycleId).single();
    if (!c) return null;
    const stats = await recomputeCycle(context.supabase, data.cycleId, c.post_type as PostType, c.year);
    await context.supabase.from("pyq_research_cycles").update(stats).eq("id", data.cycleId);
    return stats;
  });

const DOC_TYPE: Record<string, Database["public"]["Tables"]["documents"]["Insert"]["document_type"]> = {
  question_paper: "question_paper",
  answer_key: "answer_key",
  response_sheet: "response_sheet",
  syllabus: "syllabus",
  exam_notice: "notification",
  exam_schedule: "notification",
  memory_based_questions: "memory_based_paper",
  solved_questions: "memory_based_paper",
};

/** Registers approved candidates as Phase 03 documents; the client then runs the existing downloader. */
export const sendCandidatesToCollector = auth
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: cands, error } = await supabase
      .from("discovery_candidates")
      .select("*")
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    const out: { candidateId: string; documentId: string; downloadable: boolean }[] = [];
    for (const c of cands ?? []) {
      let docId = c.document_id;
      if (!docId) {
        const { data: existing } = await supabase.from("documents").select("id").eq("source_url", c.url).maybeSingle();
        docId = existing?.id ?? null;
      }
      if (!docId) {
        const { data: doc, error: dErr } = await supabase
          .from("documents")
          .insert({
            title: c.title ?? c.url,
            source_url: c.url,
            exam_id: c.exam_id,
            year: c.year_guess,
            post_type: c.post_type_guess === "unknown" ? null : c.post_type_guess,
            document_type: DOC_TYPE[c.artifact_type_guess] ?? "other",
            authority_level: c.authority_guess,
            verification_status: "unverified",
            source_notes: `Discovered via ${c.provider}: ${c.discovery_queries.join(" | ")}`.slice(0, 1000),
          })
          .select("id")
          .single();
        if (dErr) throw new Error(dErr.message);
        docId = doc.id;
      }
      await supabase.from("discovery_candidates").update({ status: "sent", document_id: docId }).eq("id", c.id);
      out.push({ candidateId: c.id, documentId: docId, downloadable: c.is_downloadable });
    }
    return out;
  });
