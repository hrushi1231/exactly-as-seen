import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { runCycleDiscovery, sendCandidatesToCollector } from "@/lib/discovery.functions";
import { downloadDocument } from "@/lib/collector.functions";
import { AUTHORITY_LABEL, AUTHORITY_LEVELS, selectClass } from "@/lib/documents";
import type { Database } from "@/integrations/supabase/types";

type Cycle = Database["public"]["Tables"]["pyq_research_cycles"]["Row"];
type Cand = Database["public"]["Tables"]["discovery_candidates"]["Row"];

export const Route = createFileRoute("/_authenticated/admin/pyq-discovery")({
  head: () => ({
    meta: [
      { title: "PYQ Discovery — PGT CS Workbench" },
      { name: "description", content: "Internet-wide search coverage for OAVS Computer Science previous-year material, 2018–2025." },
      { property: "og:title", content: "PYQ Discovery — PGT CS Workbench" },
      { property: "og:description", content: "Internet-wide search coverage for OAVS Computer Science previous-year material." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiscoveryPage,
});

const ARTIFACTS = ["question_paper","answer_key","response_sheet","question_video","memory_based_questions","solved_questions","syllabus","exam_notice","exam_schedule","cutoff","result","unknown"] as const;
const ART_LABEL: Record<string, string> = {
  question_paper: "Question paper", answer_key: "Answer key", response_sheet: "Response sheet",
  question_video: "Question video", memory_based_questions: "Memory-based", solved_questions: "Solved questions",
  syllabus: "Syllabus", exam_notice: "Exam notice", exam_schedule: "Exam schedule", cutoff: "Cut-off", result: "Result", unknown: "Unknown",
};
const POSTS = { pgt_computer_science: "PGT CS", computer_teacher: "Computer Teacher", unknown: "Unknown post" } as Record<string, string>;
const EVIDENCE: Record<string, string> = {
  unknown: "Not searched", no_exam_evidence: "No exam evidence found", exam_held_paper_not_found: "Exam held, paper not found",
  paper_found: "Paper found", memory_based_only: "Memory-based only",
};
const STATUS: Record<string, string> = { not_started: "Not started", searching: "Searching", partial: "Partial", exhaustive: "Exhaustive", needs_review: "Needs review" };

function DiscoveryPage() {
  const qc = useQueryClient();
  const run = useServerFn(runCycleDiscovery);
  const send = useServerFn(sendCandidatesToCollector);
  const download = useServerFn(downloadDocument);
  const [year, setYear] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const cycles = useQuery({
    queryKey: ["pyq-cycles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pyq_research_cycles").select("*").order("year");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const yearCycles = (cycles.data ?? []).filter((c) => c.year === year);
  const cands = useQuery({
    queryKey: ["pyq-cands", year],
    enabled: year !== null && yearCycles.length > 0,
    queryFn: async () => {
      const ids = yearCycles.map((c) => c.id);
      const { data, error } = await supabase.from("discovery_candidates").select("*").overlaps("cycle_ids", ids).order("confidence", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const queries = useQuery({
    queryKey: ["pyq-queries", year],
    enabled: year !== null && yearCycles.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("discovery_queries").select("*").in("cycle_id", yearCycles.map((c) => c.id)).order("ran_at");
      return data ?? [];
    },
  });

  const years = useMemo(() => [...new Set((cycles.data ?? []).map((c) => c.year))], [cycles.data]);
  const refresh = () => qc.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("pyq-") });

  async function searchYear(y: number) {
    for (const c of (cycles.data ?? []).filter((x) => x.year === y)) {
      setBusy(`${y}-${c.post_type}`);
      try {
        const r = await run({ data: { cycleId: c.id } });
        toast.success(`${y} ${POSTS[c.post_type]}: ${r.queries} searches, ${r.added} new leads${r.failedQueries ? `, ${r.failedQueries} failed` : ""}`);
        if (r.firstError) toast.error(r.firstError);
      } catch (e) {
        toast.error((e as Error).message);
      }
      await refresh();
    }
    setBusy(null);
  }

  async function update(id: string, patch: Partial<Cand>) {
    const { error } = await supabase.from("discovery_candidates").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    await refresh();
  }

  async function setCycle(id: string, patch: Partial<Cycle>) {
    const { error } = await supabase.from("pyq_research_cycles").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    await refresh();
  }

  async function sendPicked(ids: string[]) {
    if (!ids.length) return;
    setBusy("send");
    try {
      const out = await send({ data: { ids } });
      let ok = 0;
      for (const o of out.filter((x) => x.downloadable)) {
        const r = await download({ data: { documentId: o.documentId } });
        if (r.status !== "failed") ok++;
      }
      toast.success(`${out.length} registered as documents; ${ok} files downloaded.`);
      setPicked(new Set());
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(null);
    await refresh();
  }

  const cell = (c: Cycle | undefined) => (c ? EVIDENCE[c.evidence_status] : "—");
  const grouped = useMemo(() => {
    const m = new Map<string, Cand[]>();
    for (const c of cands.data ?? []) {
      const k = `${c.source_kind}`;
      m.set(k, [...(m.get(k) ?? []), c]);
    }
    return [...m.entries()];
  }, [cands.data]);
  const approvedDownloadable = (cands.data ?? []).filter((c) => c.status === "approved" && c.is_downloadable).map((c) => c.id);

  return (
    <AppShell title="PYQ Discovery" description="Internet-wide search for OAVS PGT Computer Science and Computer Teacher material, 2018–2025. Every value below is a guess until you confirm it.">
      <div className="mb-3 flex gap-2">
        <Button size="sm" disabled={!!busy} onClick={async () => { for (const y of years) await searchYear(y); }}>Search all years</Button>
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              {["Year","PGT CS evidence","Computer Teacher evidence","Paper","Answer key","Response sheet","Videos","Other","Candidates","Research status",""].map((h) => <th key={h} className="px-3 py-2">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {years.map((y) => {
              const cs = (cycles.data ?? []).filter((c) => c.year === y);
              const pgt = cs.find((c) => c.post_type === "pgt_computer_science");
              const ct = cs.find((c) => c.post_type === "computer_teacher");
              const any = (k: "paper_found" | "answer_key_found" | "response_sheet_found") => (cs.some((c) => c[k]) ? "Lead found" : "—");
              return (
                <tr key={y} className={`cursor-pointer border-b border-border last:border-0 hover:bg-muted/40 ${year === y ? "bg-muted/60" : ""}`} onClick={() => setYear(y)}>
                  <td className="px-3 py-2 font-medium">{y}</td>
                  <td className="px-3 py-2">{cell(pgt)}</td>
                  <td className="px-3 py-2">{cell(ct)}</td>
                  <td className="px-3 py-2">{any("paper_found")}</td>
                  <td className="px-3 py-2">{any("answer_key_found")}</td>
                  <td className="px-3 py-2">{any("response_sheet_found")}</td>
                  <td className="px-3 py-2">{cs.reduce((a, c) => a + c.video_candidates, 0)}</td>
                  <td className="px-3 py-2">{cs.reduce((a, c) => a + c.secondary_candidates, 0)}</td>
                  <td className="px-3 py-2">{cs.reduce((a, c) => a + c.candidate_count, 0)}</td>
                  <td className="px-3 py-2 text-xs">{cs.map((c) => `${POSTS[c.post_type]}: ${STATUS[c.search_status]} (${c.queries_run} q)`).join(" · ")}</td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={(e) => { e.stopPropagation(); void searchYear(y); }}>
                      {busy?.startsWith(`${y}-`) ? "Searching…" : "Search"}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {year !== null && (
        <section className="mt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">{year}</h2>
            {yearCycles.map((c) => (
              <label key={c.id} className="flex items-center gap-1 text-xs">
                {POSTS[c.post_type]}:
                <select className={selectClass} value={c.search_status} onChange={(e) => setCycle(c.id, { search_status: e.target.value })}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select className={selectClass} value={c.evidence_status} onChange={(e) => setCycle(c.id, { evidence_status: e.target.value })}>
                  {Object.entries(EVIDENCE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
            ))}
            <Button size="sm" disabled={!!busy || !picked.size} onClick={() => sendPicked([...picked])}>Send selected to collector ({picked.size})</Button>
            <Button size="sm" variant="outline" disabled={!!busy || !approvedDownloadable.length} onClick={() => sendPicked(approvedDownloadable)}>
              Download all approved files ({approvedDownloadable.length})
            </Button>
          </div>

          {!grouped.length && <p className="text-sm text-muted-foreground">No candidates yet for {year}. Run a search.</p>}
          {grouped.map(([kind, rows]) => (
            <div key={kind} className="rounded-md border border-border bg-card">
              <div className="border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{kind} · {rows.length}</div>
              {ARTIFACTS.filter((a) => rows.some((r) => r.artifact_type_guess === a)).map((a) => (
                <div key={a}>
                  <div className="bg-muted/40 px-3 py-1 text-xs font-medium">{ART_LABEL[a]}</div>
                  {rows.filter((r) => r.artifact_type_guess === a).map((c) => (
                    <div key={c.id} className={`flex flex-col gap-2 border-t border-border px-3 py-2 text-sm ${c.status === "ignored" ? "opacity-50" : ""}`}>
                      <div className="flex items-start gap-2">
                        <input type="checkbox" className="mt-1" checked={picked.has(c.id)} onChange={(e) => { const s = new Set(picked); e.target.checked ? s.add(c.id) : s.delete(c.id); setPicked(s); }} />
                        <div className="min-w-0 flex-1">
                          <a href={c.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">{c.title || c.url} <ExternalLink className="inline h-3 w-3" /></a>
                          <div className="truncate text-xs text-muted-foreground">{c.source_domain} · confidence {Number(c.confidence).toFixed(2)} · {c.status}{c.is_downloadable ? " · file" : ""}</div>
                          {c.snippet && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.snippet}</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 pl-6 text-xs">
                        <input type="number" className={`${selectClass} w-20`} placeholder="Year" defaultValue={c.year_guess ?? ""} onBlur={(e) => { const v = e.target.value ? Number(e.target.value) : null; if (v !== c.year_guess) void update(c.id, { year_guess: v }); }} />
                        <select className={selectClass} value={c.post_type_guess} onChange={(e) => update(c.id, { post_type_guess: e.target.value })}>
                          {Object.entries(POSTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select className={selectClass} value={c.artifact_type_guess} onChange={(e) => update(c.id, { artifact_type_guess: e.target.value })}>
                          {ARTIFACTS.map((k) => <option key={k} value={k}>{ART_LABEL[k]}</option>)}
                        </select>
                        <select className={selectClass} value={c.authority_guess} onChange={(e) => update(c.id, { authority_guess: e.target.value })}>
                          {AUTHORITY_LEVELS.map((k) => <option key={k} value={k}>{AUTHORITY_LABEL[k]}</option>)}
                        </select>
                        <Button size="sm" variant="outline" onClick={() => update(c.id, { status: "approved" })}>Approve</Button>
                        <Button size="sm" variant="ghost" onClick={() => update(c.id, { status: "ignored" })}>Ignore</Button>
                        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => sendPicked([c.id])}>Send to collector</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ))}

          <details className="rounded-md border border-border bg-card p-3 text-xs">
            <summary className="cursor-pointer font-medium">Search queries used ({queries.data?.length ?? 0})</summary>
            <ul className="mt-2 space-y-1">
              {(queries.data ?? []).map((q) => (
                <li key={q.id}>[{q.query_kind}] {q.query} — {q.error ? `error: ${q.error}` : `${q.result_count} results`}</li>
              ))}
            </ul>
          </details>
        </section>
      )}
    </AppShell>
  );
}
