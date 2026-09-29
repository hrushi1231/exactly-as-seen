import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { selectClass } from "@/lib/documents";
import type { Database } from "@/integrations/supabase/types";

type Video = Database["public"]["Tables"]["video_sources"]["Row"];
type Question = Database["public"]["Tables"]["questions"]["Row"];
type Option = Database["public"]["Tables"]["question_options"]["Row"];
type Occ = Database["public"]["Tables"]["question_occurrences"]["Row"];
type Ev = Database["public"]["Tables"]["question_evidence"]["Row"];
type Row = Question & { question_options: Option[]; question_occurrences: Occ[]; question_evidence: Ev[] };

export const Route = createFileRoute("/_authenticated/admin/video-reconstruction")({
  head: () => ({
    meta: [
      { title: "Video Reconstruction — PGT CS Workbench" },
      { name: "description", content: "Review OAVS questions reconstructed from public exam-prep videos, with timestamps and raw evidence." },
      { property: "og:title", content: "Video Reconstruction — PGT CS Workbench" },
      { property: "og:description", content: "Review reconstructed OAVS questions with OCR and transcript evidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const POSTS: Record<string, string> = { pgt_computer_science: "PGT CS", computer_teacher: "Computer Teacher" };
const VS: Record<string, string> = {
  RAW_RECONSTRUCTION: "Raw reconstruction", NEEDS_REVIEW: "Needs review", VIDEO_RECONSTRUCTED: "Verified (reconstructed)",
  CROSS_SOURCE_RECONSTRUCTED: "Cross-source", VERIFIED_SECONDARY: "Verified secondary", OFFICIAL_VERIFIED: "Official", REJECTED: "Rejected",
};
const CLAIM: Record<string, string> = {
  ACTUAL_PYQ_CLAIM: "Claimed as actual PYQ", PRACTICE_QUESTION: "Practice", MODEL_QUESTION: "Model", EXPLANATION_ONLY: "Explanation", UNKNOWN: "Claim unknown",
};
const fmt = (s: number | null | undefined) => (s == null ? "—" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`);
const isHigh = (q: Question) => q.confidence >= 0.8 && q.quality_flags.length === 0 && q.verification_status === "RAW_RECONSTRUCTION";

function Page() {
  const [open, setOpen] = useState<string | null>(null);
  const videos = useQuery({
    queryKey: ["vr-videos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("video_sources").select("*, exam_cycles(label), video_processing_runs(status,error,transcript_source,started_at)").order("video_publish_date");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const stats = useQuery({
    queryKey: ["vr-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("question_occurrences").select("source_video_id, questions!inner(verification_status, confidence, quality_flags, merged_into_id)");
      if (error) throw new Error(error.message);
      const m: Record<string, { n: number; high: number; review: number; cross: number }> = {};
      for (const o of data) {
        const q = o.questions as unknown as Question;
        if (q.merged_into_id) continue;
        const s = (m[o.source_video_id] ??= { n: 0, high: 0, review: 0, cross: 0 });
        s.n++;
        if (q.confidence >= 0.8 && q.quality_flags.length === 0) s.high++;
        if (q.verification_status === "NEEDS_REVIEW") s.review++;
        if (q.verification_status === "CROSS_SOURCE_RECONSTRUCTED") s.cross++;
      }
      return m;
    },
  });
  const video = videos.data?.find((v) => v.id === open);

  return (
    <AppShell title="Video Reconstruction" description="Questions rebuilt from public OAVS exam-prep videos. Every item is a candidate until you review it; video answers are never treated as official.">
      {video ? (
        <VideoDetail video={video} onBack={() => setOpen(null)} />
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 text-left text-xs text-muted-foreground">
              <tr>{["Video", "Post", "Uploaded", "Claimed / resolved exam", "Status", "Duration", "Questions", "High conf.", "Needs review", "Cross-source"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {(videos.data ?? []).map((v) => {
                const s = stats.data?.[v.id];
                const run = [...(v.video_processing_runs ?? [])].sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
                return (
                  <tr key={v.id} className="cursor-pointer border-t border-border hover:bg-secondary/40" onClick={() => setOpen(v.id)}>
                    <td className="max-w-xs px-3 py-2"><div className="truncate font-medium">{v.title ?? v.video_id}</div><div className="text-xs text-muted-foreground">{v.channel ?? "Channel not resolved"}</div></td>
                    <td className="px-3 py-2">{POSTS[v.post_type]}</td>
                    <td className="px-3 py-2">{v.video_publish_date?.slice(0, 10) ?? "—"}</td>
                    <td className="max-w-xs px-3 py-2 text-xs"><div>Claimed: {v.claimed_exam_year ?? "none"}</div><div>Resolved: {(v.exam_cycles as { label: string } | null)?.label ?? "unresolved"} ({v.exam_year_confidence})</div></td>
                    <td className="px-3 py-2 text-xs">{v.processing_status}{run?.error ? <div className="text-destructive">{run.error.slice(0, 80)}</div> : null}</td>
                    <td className="px-3 py-2">{fmt(v.duration_seconds)}</td>
                    <td className="px-3 py-2">{s?.n ?? 0}</td>
                    <td className="px-3 py-2">{s?.high ?? 0}</td>
                    <td className="px-3 py-2">{s?.review ?? 0}</td>
                    <td className="px-3 py-2">{s?.cross ?? 0}</td>
                  </tr>
                );
              })}
              {videos.data?.length === 0 && <tr><td colSpan={10} className="px-3 py-6 text-center text-muted-foreground">No videos processed yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}

function VideoDetail({ video, onBack }: { video: Video & { exam_cycles: unknown }; onBack: () => void }) {
  const qc = useQueryClient();
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const key = ["vr-questions", video.id];
  const qs = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: occ, error: e1 } = await supabase.from("question_occurrences").select("question_id").eq("source_video_id", video.id);
      if (e1) throw new Error(e1.message);
      const ids = occ.map((o) => o.question_id);
      if (!ids.length) return [] as Row[];
      const { data, error } = await supabase.from("questions").select("*, question_options(*), question_occurrences(*), question_evidence(*)").in("id", ids).is("merged_into_id", null);
      if (error) throw new Error(error.message);
      return (data as Row[]).sort((a, b) => (a.question_occurrences[0]?.source_timestamp_start ?? 0) - (b.question_occurrences[0]?.source_timestamp_start ?? 0));
    },
  });
  const rows = useMemo(() => (qs.data ?? []).filter((q) => filter === "all" || (filter === "high" ? isHigh(q) : q.verification_status === filter)), [qs.data, filter]);
  const cur = qs.data?.find((q) => q.id === sel) ?? rows[0];
  const occ = cur?.question_occurrences.find((o) => o.source_video_id === video.id) ?? cur?.question_occurrences[0];
  const refresh = () => { qc.invalidateQueries({ queryKey: key }); qc.invalidateQueries({ queryKey: ["vr-stats"] }); };

  async function setStatus(ids: string[], status: Question["verification_status"]) {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("questions").update({ verification_status: status, reviewed_by: u.user?.id ?? null, reviewed_at: new Date().toISOString() }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    await supabase.from("question_occurrences").update({ verification_status: status }).in("question_id", ids);
    if (status === "REJECTED") await supabase.from("gold_corpus").delete().in("question_id", ids);
    toast.success(`${ids.length} updated`);
    setPicked(new Set());
    refresh();
  }

  async function merge() {
    const ids = [...picked];
    if (ids.length < 2) { toast.error("Tick at least two candidates to merge"); return; }
    const keep = ids[0] as string;
    const rest = ids.slice(1);
    const { error } = await supabase.from("questions").update({ merged_into_id: keep, verification_status: "REJECTED", quality_flags: ["merged_duplicate"] }).in("id", rest);
    if (error) { toast.error(error.message); return; }
    // Evidence and occurrences move to the kept question; nothing is deleted.
    await supabase.from("question_occurrences").update({ question_id: keep }).in("question_id", rest);
    await supabase.from("question_evidence").update({ question_id: keep }).in("question_id", rest);
    await supabase.from("gold_corpus").delete().in("question_id", rest);
    toast.success("Merged; all evidence kept");
    setPicked(new Set());
    setSel(keep);
    refresh();
  }

  async function split(q: Row) {
    const { id: _id, created_at: _c, updated_at: _u, question_options, question_occurrences, question_evidence, ...base } = q;
    const { data: nq, error } = await supabase.from("questions").insert({ ...base, verification_status: "NEEDS_REVIEW", quality_flags: [...base.quality_flags, "split_from_candidate"], reviewed_at: null, reviewed_by: null }).select("id").single();
    if (error) { toast.error(error.message); return; }
    if (question_options.length) await supabase.from("question_options").insert(question_options.map(({ id: _i, question_id: _q, ...o }) => ({ ...o, question_id: nq.id })));
    for (const o of question_occurrences) {
      const { id: _i, question_id: _q, created_at: _cc, ...rest } = o;
      const { data: no } = await supabase.from("question_occurrences").insert({ ...rest, question_id: nq.id, verification_status: "NEEDS_REVIEW" }).select("id").single();
      const evs = question_evidence.filter((e) => e.occurrence_id === o.id).map(({ id: _e, question_id: _qq, created_at: _ec, ...e }) => ({ ...e, question_id: nq.id, occurrence_id: no?.id ?? null }));
      if (evs.length) await supabase.from("question_evidence").insert(evs);
    }
    toast.success("Split: a copy with the same evidence was created — edit each part");
    setSel(nq.id);
    refresh();
  }

  const highIds = (qs.data ?? []).filter(isHigh).map((q) => q.id);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="mr-1 h-4 w-4" />All videos</Button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{video.title}</div>
          <div className="text-xs text-muted-foreground">{video.channel} · uploaded {video.video_publish_date?.slice(0, 10)} · {POSTS[video.post_type]} · {CLAIM[video.pyq_claim]}</div>
          <div className="text-xs text-muted-foreground">Exam year: {video.exam_year_evidence ?? "not resolved"}</div>
        </div>
        <select className={selectClass} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option><option value="high">High confidence, unflagged</option>
          {Object.entries(VS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <Button size="sm" variant="outline" disabled={!highIds.length} onClick={() => setStatus(highIds, "VIDEO_RECONSTRUCTED")}>Verify {highIds.length} high-confidence</Button>
        <Button size="sm" variant="outline" disabled={picked.size < 2} onClick={merge}>Merge ticked ({picked.size})</Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">
          <div className="aspect-video overflow-hidden rounded-md border border-border bg-muted">
            <iframe key={`${cur?.id}-${occ?.source_timestamp_start}`} title="Source video" className="h-full w-full" allowFullScreen
              src={`https://www.youtube-nocookie.com/embed/${video.video_id}?start=${Math.floor(occ?.source_timestamp_start ?? 0)}`} />
          </div>
          <div className="max-h-[520px] overflow-y-auto rounded-md border border-border">
            {rows.map((q) => {
              const o = q.question_occurrences[0];
              return (
                <div key={q.id} className={`flex cursor-pointer items-start gap-2 border-b border-border px-3 py-2 text-sm ${cur?.id === q.id ? "bg-secondary" : "hover:bg-secondary/40"}`} onClick={() => setSel(q.id)}>
                  <input type="checkbox" className="mt-1" checked={picked.has(q.id)} onClick={(e) => e.stopPropagation()} onChange={(e) => { const s = new Set(picked); if (e.target.checked) s.add(q.id); else s.delete(q.id); setPicked(s); }} />
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2">{o?.question_number ? `Q${o.question_number}. ` : ""}{q.question_text}</div>
                    <div className="text-xs text-muted-foreground">{fmt(o?.source_timestamp_start)} · {VS[q.verification_status]} · {Math.round(q.confidence * 100)}%</div>
                  </div>
                </div>
              );
            })}
            {!rows.length && <div className="p-4 text-sm text-muted-foreground">{qs.isLoading ? "Loading…" : "No candidates for this filter."}</div>}
          </div>
        </div>
        {cur ? <QuestionPanel key={cur.id} q={cur} videoId={video.video_id} onStatus={(s) => setStatus([cur.id], s)} onSplit={() => split(cur)} onSaved={refresh} /> : <div />}
      </div>
    </div>
  );
}

function QuestionPanel({ q, videoId, onStatus, onSplit, onSaved }: { q: Row; videoId: string; onStatus: (s: Question["verification_status"]) => void; onSplit: () => void; onSaved: () => void }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(q.question_text);
  const opts = [...q.question_options].sort((a, b) => a.display_order - b.display_order);
  const [optText, setOptText] = useState<Record<string, string>>(Object.fromEntries(opts.map((o) => [o.id, o.option_text])));
  const occ = q.question_occurrences[0];

  async function save() {
    // Only normalized fields change; source_text, raw option text and all evidence stay untouched.
    const { error } = await supabase.from("questions").update({ question_text: text, normalization_status: "admin_edited" }).eq("id", q.id);
    if (error) { toast.error(error.message); return; }
    for (const o of opts) if (optText[o.id] !== o.option_text) await supabase.from("question_options").update({ option_text: optText[o.id] ?? o.option_text }).eq("id", o.id);
    toast.success("Normalized text saved; raw evidence unchanged");
    setEdit(false);
    onSaved();
  }

  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="rounded bg-secondary px-2 py-0.5">{VS[q.verification_status]}</span>
        <span className="rounded bg-secondary px-2 py-0.5">{CLAIM[q.pyq_claim]}</span>
        <span className="rounded bg-secondary px-2 py-0.5">Confidence {Math.round(q.confidence * 100)}%</span>
        <span className="rounded bg-secondary px-2 py-0.5">{fmt(occ?.source_timestamp_start)}–{fmt(occ?.source_timestamp_end)}</span>
        {q.quality_flags.map((f) => <span key={f} className="rounded bg-destructive/10 px-2 py-0.5 text-destructive">{f.replaceAll("_", " ")}</span>)}
      </div>

      {edit ? (
        <div className="space-y-2">
          <textarea className="min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm" value={text} onChange={(e) => setText(e.target.value)} />
          {opts.map((o) => (
            <div key={o.id} className="flex items-center gap-2 text-sm"><span className="w-6">{o.label}.</span>
              <input className="flex-1 rounded-md border border-input bg-background px-2 py-1" value={optText[o.id] ?? ""} onChange={(e) => setOptText({ ...optText, [o.id]: e.target.value })} /></div>
          ))}
          <div className="flex gap-2"><Button size="sm" onClick={save}>Save normalization</Button><Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Cancel</Button></div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-sm font-medium">{occ?.question_number ? `Q${occ.question_number}. ` : ""}{q.question_text}</p>
          <ol className="space-y-1 text-sm">
            {opts.map((o) => <li key={o.id} className={o.is_presented_answer ? "font-semibold text-primary" : ""}>{o.label}. {o.option_text}{o.is_presented_answer ? " ← presented answer" : ""}</li>)}
            {!opts.length && <li className="text-muted-foreground">No options detected</li>}
          </ol>
          <p className="text-xs text-muted-foreground">Answer: {q.answer_label ? `${q.answer_label} (${q.answer_status === "PRESENTER_VISUAL" ? "marked on screen by presenter" : q.answer_status === "PRESENTER_STATED" ? "stated by presenter" : q.answer_status})` : "none shown"} — not an official answer.</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => onStatus("VIDEO_RECONSTRUCTED")}>Verify as reconstructed</Button>
        <Button size="sm" variant="outline" onClick={() => onStatus("NEEDS_REVIEW")}>Needs review</Button>
        <Button size="sm" variant="outline" onClick={() => onStatus("REJECTED")}>Reject</Button>
        <Button size="sm" variant="outline" onClick={() => setEdit(true)}>Edit normalization</Button>
        <Button size="sm" variant="outline" onClick={onSplit}>Split candidate</Button>
      </div>

      {occ && <SyllabusMap occ={occ} onSaved={onSaved} />}

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Evidence</h3>
        <details className="rounded border border-border p-2 text-xs"><summary className="cursor-pointer">Source reconstruction (as first extracted)</summary><pre className="mt-2 whitespace-pre-wrap">{q.source_text}</pre></details>
        {[...q.question_evidence].sort((a, b) => a.evidence_type.localeCompare(b.evidence_type)).map((e) => (
          <details key={e.id} className="rounded border border-border p-2 text-xs" open={e.evidence_type === "PRESENTER_ANSWER" || e.evidence_type === "SECOND_VIDEO_MATCH"}>
            <summary className="cursor-pointer">
              {e.evidence_type.replaceAll("_", " ").toLowerCase()} · {fmt(e.timestamp_start)}{e.timestamp_end ? `–${fmt(e.timestamp_end)}` : ""}{e.confidence != null ? ` · ${Math.round(e.confidence * 100)}%` : ""}
              <a href={e.source_url.includes("youtube") && !e.source_url.includes("&t=") && e.timestamp_start != null ? `${e.source_url}&t=${Math.floor(e.timestamp_start)}s` : e.source_url} target="_blank" rel="noreferrer" className="ml-2 inline-flex items-center text-primary" onClick={(ev) => ev.stopPropagation()}>open<ExternalLink className="ml-0.5 h-3 w-3" /></a>
            </summary>
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap">{e.raw_text}</pre>
          </details>
        ))}
        <p className="text-xs text-muted-foreground">Video: youtube.com/watch?v={videoId}</p>
      </div>
    </div>
  );
}

function SyllabusMap({ occ, onSaved }: { occ: Occ; onSaved: () => void }) {
  const syl = useQuery({
    queryKey: ["vr-syllabus"],
    staleTime: 600_000,
    queryFn: async () => {
      const [s, t, st] = await Promise.all([
        supabase.from("subjects").select("id,name").order("display_order"),
        supabase.from("topics").select("id,name,subject_id").order("display_order"),
        supabase.from("subtopics").select("id,name,topic_id").order("display_order"),
      ]);
      return { subjects: s.data ?? [], topics: t.data ?? [], subtopics: st.data ?? [] };
    },
  });
  const [subject, setSubject] = useState(occ.subject_id ?? "");
  const [topic, setTopic] = useState(occ.topic_id ?? "");
  const [sub, setSub] = useState(occ.subtopic_id ?? "");
  async function save() {
    const { error } = await supabase.from("question_occurrences").update({ subject_id: subject || null, topic_id: topic || null, subtopic_id: sub || null }).eq("id", occ.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Syllabus mapping saved");
    onSaved();
  }
  const d = syl.data;
  return (
    <div className="space-y-2 rounded border border-border p-2">
      <div className="text-xs font-medium">Map to Annexure-VI syllabus (manual)</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <select className={selectClass} value={subject} onChange={(e) => { setSubject(e.target.value); setTopic(""); setSub(""); }}>
          <option value="">Subject…</option>{d?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className={selectClass} value={topic} onChange={(e) => { setTopic(e.target.value); setSub(""); }} disabled={!subject}>
          <option value="">Topic…</option>{d?.topics.filter((t) => t.subject_id === subject).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <select className={selectClass} value={sub} onChange={(e) => setSub(e.target.value)} disabled={!topic}>
          <option value="">Subtopic…</option>{d?.subtopics.filter((t) => t.topic_id === topic).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <Button size="sm" variant="outline" onClick={save}>Save mapping</Button>
    </div>
  );
}
