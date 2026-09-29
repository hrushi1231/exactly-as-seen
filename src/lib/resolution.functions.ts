import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { canonicalizeUrl, classify, firecrawlScrape, FirecrawlDiscoveryProvider } from "./discovery/providers.server";
import { analyze, authorityFor, classifyVideo, fetchLead, fileChecks, pickChildren } from "./discovery/resolver.server";
import { firstPagesText } from "./discovery/pdf-text.server";
import { downloadDocumentCore } from "./collector/core.server";

type DB = SupabaseClient<Database>;
type Cand = Database["public"]["Tables"]["discovery_candidates"]["Row"];
type CandUpdate = Database["public"]["Tables"]["discovery_candidates"]["Update"];

async function assertAdmin(supabase: DB, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Administrator access required");
}
const auth = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]);

const PAPERISH = new Set(["question_paper", "answer_key", "final_answer_key", "provisional_answer_key", "response_sheet"]);
const DOC_TYPE: Record<string, Database["public"]["Tables"]["documents"]["Insert"]["document_type"]> = {
  question_paper: "question_paper", answer_key: "answer_key", final_answer_key: "answer_key", provisional_answer_key: "answer_key",
  response_sheet: "response_sheet", syllabus: "syllabus", recruitment_notice: "notification", exam_schedule: "notification",
  memory_based_questions: "memory_based_paper", solved_questions: "memory_based_paper",
};

async function insertChildren(supabase: DB, parent: Cand, links: { url: string; anchor: string }[]) {
  let added = 0;
  for (const l of links) {
    let key: string;
    try { key = canonicalizeUrl(l.url); } catch { continue; }
    const { data: ex } = await supabase.from("discovery_candidates").select("id").eq("canonical_url", key).maybeSingle();
    if (ex) continue;
    const c = classify({ url: l.url, title: l.anchor, snippet: `via ${parent.url}` }, parent.year_value ?? parent.year_guess ?? 0);
    const { error } = await supabase.from("discovery_candidates").insert({
      canonical_url: key, url: l.url, title: l.anchor || null, snippet: `Linked from ${parent.page_title ?? parent.url}`,
      source_domain: c.sourceDomain, source_kind: c.sourceKind, exam_id: parent.exam_id,
      post_type_guess: c.postTypeGuess, year_guess: c.yearGuess ?? parent.year_guess, artifact_type_guess: c.artifactTypeGuess,
      authority_guess: c.authorityGuess, confidence: c.confidence, is_downloadable: c.isDownloadable,
      discovery_queries: parent.discovery_queries, cycle_ids: parent.cycle_ids, provider: "resolver",
      depth: parent.depth + 1, parent_candidate_id: parent.id,
    });
    if (!error) added++;
  }
  return added;
}

async function findCycle(supabase: DB, year: number | null) {
  if (!year) return null;
  const { data } = await supabase.from("exam_cycles").select("id, exam_year, recruitment_cycle").or(`exam_year.eq.${year},recruitment_cycle.eq.${year}`).order("display_order").limit(1);
  return data?.[0]?.id ?? null;
}

async function resolveOne(supabase: DB, userId: string, c: Cand) {
  const pf = await fetchLead(c.url, c.depth === 0 ? firecrawlScrape : undefined);
  const now = new Date().toISOString();
  const upd: CandUpdate = { resolved_at: now, page_title: pf.title, publication_date: pf.publicationDate };
  let children = 0;
  const domain = c.source_domain;

  if (!pf.ok) {
    const dead = pf.status === 404 || pf.status === 410 || /ENOTFOUND|getaddrinfo|dns/i.test(pf.blockedReason ?? "");
    Object.assign(upd, { resolution_status: dead ? "dead_link" : "blocked", resolution_reason: pf.blockedReason ?? `HTTP ${pf.status}`, resolution_score: 0 });
    await supabase.from("discovery_candidates").update(upd).eq("id", c.id);
    return { status: upd.resolution_status, children };
  }

  const parentAnchor = c.title;
  if (pf.kind === "youtube" && pf.video) {
    const a = analyze({ url: c.url, title: pf.title, text: pf.text, publicationDate: pf.publicationDate, kind: "youtube", targetYear: c.year_guess });
    const vc = classifyVideo(pf.video, a);
    Object.assign(upd, {
      video_id: pf.video.videoId, video_channel: pf.video.channel, video_published_at: pf.video.uploadDate,
      video_duration_seconds: pf.video.durationSeconds, video_description: pf.video.description, captions_available: pf.video.captionsAvailable,
      video_class: vc, post_matches: a.postMatches, year_value: a.yearValue, year_confidence: a.yearConfidence, year_evidence: a.yearEvidence,
      authority: "community", resolution_score: a.score,
      resolved_artifact_type: vc === "memory_based_pyq" || vc === "paper_walkthrough" ? "video_reconstruction" : null,
      resolution_status: vc === "unrelated" ? "auto_irrelevant" : vc === "memory_based_pyq" || vc === "paper_walkthrough" ? "artifact_found" : "relevant",
      resolution_reason: vc === "unrelated" ? "Video is not about the OAVS Computer Science/Computer Teacher exam" : `Video classified as ${vc}`,
      post_type_guess: a.exactPgtCs ? "pgt_computer_science" : a.exactComputerTeacher ? "computer_teacher" : c.post_type_guess,
    });
    await supabase.from("discovery_candidates").update(upd).eq("id", c.id);
    if (upd.resolution_status === "artifact_found") await addGold(supabase, { ...c, ...upd } as Cand, "C", "Video reconstruction; not an official paper");
    return { status: upd.resolution_status, children };
  }

  if (pf.kind === "file") {
    const context = `${c.title ?? ""} ${c.snippet ?? ""} ${decodeURIComponent(c.url)}`;
    const worth = /computer|comp\.?\s*sc|\bcs\b/i.test(context) || /oav\.edu\.in/.test(domain) || /advt|notification|answer\s*key/i.test(context);
    if (!worth) {
      Object.assign(upd, { resolution_status: "relevant", resolution_reason: "Public file, but nothing names the Computer Science post; not downloaded", resolution_score: 0 });
      await supabase.from("discovery_candidates").update(upd).eq("id", c.id);
      return { status: "relevant", children };
    }
    let docId = c.document_id;
    if (!docId) {
      const { data: ex } = await supabase.from("documents").select("id").eq("source_url", c.url).maybeSingle();
      docId = ex?.id ?? null;
    }
    if (!docId) {
      const { data: d, error } = await supabase.from("documents").insert({
        title: c.title ?? c.url, source_url: c.url, exam_id: c.exam_id, year: c.year_guess,
        document_type: "other", authority_level: "unknown", verification_status: "unverified",
        source_notes: `Resolved from discovery lead (depth ${c.depth})`,
      }).select("id").single();
      if (error) throw new Error(error.message);
      docId = d.id;
    }
    const dl = await downloadDocumentCore(supabase, userId, docId);
    if (dl.status === "failed" || !dl.bytes) {
      Object.assign(upd, { document_id: docId, resolution_status: "blocked", resolution_reason: `Download failed: ${dl.message}` });
      await supabase.from("discovery_candidates").update(upd).eq("id", c.id);
      return { status: "blocked", children };
    }
    const text = dl.mimeType?.includes("pdf") ? await firstPagesText(dl.bytes) : "";
    const fc = fileChecks(text);
    const a = analyze({ url: c.url, title: c.title, text, publicationDate: null, kind: "file", anchor: parentAnchor, targetYear: c.year_guess });
    const officialHeader = fc.oavs && fc.looks_like_notice;
    const authority = authorityFor(domain, officialHeader);
    const artifact = fc.looks_like_response_sheet ? "response_sheet" : fc.looks_like_answer_key ? (a.artifact && a.artifact.endsWith("answer_key") ? a.artifact : "answer_key") : fc.looks_like_question_paper ? "question_paper" : a.artifact ?? (fc.looks_like_notice ? "recruitment_notice" : "other");
    const postOk = fc.pgt_computer_science || fc.computer_teacher;
    const status = !fc.text_extracted ? "relevant" : !fc.oavs ? "irrelevant" : postOk ? "artifact_found" : a.otherSubjectsOnly ? "wrong_post" : "relevant";
    Object.assign(upd, {
      document_id: docId, file_checks: fc, authority, resolved_artifact_type: artifact, post_matches: a.postMatches,
      year_value: fc.years[0] ?? a.yearValue, year_confidence: fc.years.length ? "high" : a.yearConfidence,
      year_evidence: fc.years.length ? `file text mentions ${fc.years.join(", ")}` : a.yearEvidence,
      advertisement_numbers: fc.advertisement_numbers, exam_dates: fc.dates,
      resolution_status: status, resolution_score: a.score,
      resolution_reason: !fc.text_extracted ? "File downloaded; no extractable text (scanned?)" : `File checks: OAVS ${fc.oavs ? "yes" : "no"}, PGT CS ${fc.pgt_computer_science ? "yes" : "no"}, Computer Teacher ${fc.computer_teacher ? "yes" : "no"}`,
      post_type_guess: fc.pgt_computer_science && !fc.computer_teacher ? "pgt_computer_science" : fc.computer_teacher && !fc.pgt_computer_science ? "computer_teacher" : c.post_type_guess,
    });
    await supabase.from("documents").update({
      document_type: DOC_TYPE[artifact] ?? "other",
      authority_level: authority === "official" || authority === "official_mirror" ? "official" : authority === "community" ? "memory_based" : "secondary",
      year: (upd.year_value as number | null) ?? null,
      post_type: upd.post_type_guess === "unknown" ? null : (upd.post_type_guess as string),
    }).eq("id", docId);
    await supabase.from("discovery_candidates").update(upd).eq("id", c.id);
    if (status === "artifact_found") {
      const merged = { ...c, ...upd } as Cand;
      const official = authority === "official" || authority === "official_mirror";
      const level = PAPERISH.has(artifact) && official ? "A" : PAPERISH.has(artifact) && fc.years.length ? "B" : artifact === "memory_based_questions" || artifact === "solved_questions" ? "C" : "D";
      await addGold(supabase, merged, level, `${artifact}; ${upd.resolution_reason}`);
    }
    return { status, children };
  }

  // HTML page
  const a = analyze({ url: pf.finalUrl, title: pf.title ?? c.title, text: pf.text, publicationDate: pf.publicationDate, kind: "html", targetYear: c.year_guess });
  let status: string, reason: string;
  if (!a.oavs) { status = "auto_irrelevant"; reason = "No OAVS identifier on the page"; }
  else if (a.otherSubjectsOnly && !a.exactPgtCs && !a.exactComputerTeacher) { status = "wrong_post"; reason = "Page is about a different subject/post"; }
  else if (!a.exactPgtCs && !a.exactComputerTeacher) { status = "auto_irrelevant"; reason = "OAVS page, but it never names PGT Computer Science or Computer Teacher"; }
  else if (a.genericListing) { status = "index_page"; reason = "Generic OAVS listing page; followed Computer Science links"; }
  else { status = "relevant"; reason = `Mentions ${a.postMatches.slice(0, 3).join(", ")}`; }
  if ((status === "index_page" || status === "relevant") && c.depth < 3) {
    children = await insertChildren(supabase, c, pickChildren(pf.links, pf.finalUrl));
  }
  Object.assign(upd, {
    resolution_status: status, resolution_reason: reason, resolution_score: a.score, post_matches: a.postMatches,
    year_value: a.yearValue, year_confidence: a.yearConfidence, year_evidence: a.yearEvidence,
    advertisement_numbers: a.advertisementNumbers, exam_dates: a.examDates, authority: a.authority,
    resolved_artifact_type: status === "relevant" ? a.artifact : null,
    post_type_guess: a.exactPgtCs && !a.exactComputerTeacher ? "pgt_computer_science" : a.exactComputerTeacher && !a.exactPgtCs ? "computer_teacher" : c.post_type_guess,
  });
  await supabase.from("discovery_candidates").update(upd).eq("id", c.id);
  return { status, children };
}

async function addGold(supabase: DB, c: Cand, level: "A" | "B" | "C" | "D", reason: string) {
  const posts = c.post_type_guess === "unknown"
    ? ((c.file_checks as { pgt_computer_science?: boolean; computer_teacher?: boolean } | null)?.pgt_computer_science ? ["pgt_computer_science"] : []).concat(
        (c.file_checks as { computer_teacher?: boolean } | null)?.computer_teacher ? ["computer_teacher"] : [])
    : [c.post_type_guess];
  const cycleId = await findCycle(supabase, c.year_value);
  for (const post of posts) {
    await supabase.from("gold_corpus").upsert({
      post_type: post, artifact_type: c.resolved_artifact_type ?? "other", quality_level: level, candidate_id: c.id,
      document_id: c.document_id, url: c.url, title: c.page_title ?? c.title, reason, cycle_id: cycleId,
    }, { onConflict: "url,post_type" });
  }
}

export const resolveLeadsBatch = auth
  .inputValidator((d) => z.object({ limit: z.number().int().min(1).max(25).default(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: batch, error } = await supabase.from("discovery_candidates").select("*")
      .eq("resolution_status", "unresolved").lte("depth", 3)
      .order("depth").order("confidence", { ascending: false }).limit(data.limit);
    if (error) throw new Error(error.message);
    const out: Record<string, number> = {};
    let children = 0;
    await Promise.all((batch ?? []).map(async (c) => {
      try {
        const r = await resolveOne(supabase, userId, c);
        out[r.status ?? "?"] = (out[r.status ?? "?"] ?? 0) + 1;
        children += r.children;
      } catch (e) {
        await supabase.from("discovery_candidates").update({ resolution_status: "blocked", resolution_reason: `Resolver error: ${(e as Error).message}`.slice(0, 500), resolved_at: new Date().toISOString() }).eq("id", c.id);
        out["error"] = (out["error"] ?? 0) + 1;
      }
    }));
    const { count } = await supabase.from("discovery_candidates").select("id", { count: "exact", head: true }).eq("resolution_status", "unresolved");
    return { processed: batch?.length ?? 0, byStatus: out, childrenAdded: children, remaining: count ?? 0 };
  });

export const restoreLead = auth
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    await context.supabase.from("discovery_candidates").update({ resolution_status: "relevant", resolution_reason: "Restored by administrator" }).eq("id", data.id);
    return { ok: true };
  });

/** Targeted second-pass search for a real cycle/post using its advertisement number and exam date. */
export const secondPassSearch = auth
  .inputValidator((d) => z.object({ cycleId: z.string().uuid(), post: z.enum(["pgt_computer_science", "computer_teacher"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: cy, error } = await supabase.from("exam_cycles").select("*").eq("id", data.cycleId).single();
    if (error) throw new Error(error.message);
    const year = cy.exam_year ?? cy.recruitment_cycle;
    const postName = data.post === "pgt_computer_science" ? "PGT Computer Science" : "Computer Teacher";
    const { data: gold } = await supabase.from("gold_corpus").select("artifact_type").eq("cycle_id", cy.id).eq("post_type", data.post).in("quality_level", ["A", "B"]);
    const have = new Set((gold ?? []).map((g) => g.artifact_type));
    const q: { query: string; kind: string }[] = [];
    const advt = cy.advertisement_number ? `Advt ${cy.advertisement_number}` : "";
    const date = cy.exam_date ?? "";
    if (!have.has("question_paper")) {
      q.push({ kind: "second_pass_paper", query: `OAVS ${postName} ${date || year} question paper ${advt}`.replace(/\s+/g, " ").trim() });
      q.push({ kind: "second_pass_paper", query: `"Odisha Adarsha Vidyalaya" "${postName}" ${year} question paper pdf` });
    }
    if (![...have].some((t) => t.includes("answer_key"))) q.push({ kind: "second_pass_key", query: `OAVS ${postName} ${date || year} answer key ${advt}`.replace(/\s+/g, " ").trim() });
    if (!have.has("response_sheet")) q.push({ kind: "second_pass_response", query: `OAVS ${postName} ${year} response sheet digialm` });
    if (!q.length) return { queries: 0, added: 0, message: "No gaps for this cycle/post" };

    const { data: pyq } = await supabase.from("pyq_research_cycles").select("id").eq("post_type", data.post).eq("year", year ?? 0).maybeSingle();
    const provider = new FirecrawlDiscoveryProvider();
    let added = 0;
    for (const item of q) {
      let hits: Awaited<ReturnType<typeof provider.search>> = [];
      let err: string | null = null;
      try { hits = await provider.search(item.query, { limit: 10 }); } catch (e) { err = (e as Error).message; }
      if (pyq) await supabase.from("discovery_queries").insert({ cycle_id: pyq.id, provider: provider.name, query: item.query, query_kind: item.kind, result_count: hits.length, error: err });
      for (const h of hits) {
        let key: string;
        try { key = canonicalizeUrl(h.url); } catch { continue; }
        const { data: ex } = await supabase.from("discovery_candidates").select("id, discovery_queries").eq("canonical_url", key).maybeSingle();
        if (ex) {
          await supabase.from("discovery_candidates").update({ discovery_queries: [...new Set([...ex.discovery_queries, item.query])] }).eq("id", ex.id);
          continue;
        }
        const c = classify(h, year ?? 0);
        if (!c.relevant) continue;
        const { error: iErr } = await supabase.from("discovery_candidates").insert({
          canonical_url: key, url: h.url, title: h.title, snippet: h.snippet, source_domain: c.sourceDomain, source_kind: c.sourceKind,
          exam_id: cy.exam_id, post_type_guess: c.postTypeGuess, year_guess: c.yearGuess, artifact_type_guess: c.artifactTypeGuess,
          authority_guess: c.authorityGuess, confidence: c.confidence, is_downloadable: c.isDownloadable,
          discovery_queries: [item.query], cycle_ids: pyq ? [pyq.id] : [], provider: `${provider.name}:second_pass`,
        });
        if (!iErr) added++;
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    return { queries: q.length, added, message: `Ran ${q.length} targeted searches` };
  });
