import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Download, ExternalLink, EyeOff, Link2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AuthorityBadge, StatusPill } from "@/components/authority-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { downloadDocument, inspectUrl } from "@/lib/collector.functions";
import {
  AUTHORITY_LABEL,
  AUTHORITY_LEVELS,
  DOCUMENT_TYPE_LABEL,
  DOCUMENT_TYPES,
  DOWNLOAD_LABEL,
  DOWNLOAD_STATUSES,
  VERIFICATION,
  VERIFICATION_LABEL,
  formatBytes,
  formatDate,
  selectClass,
  type CandidateLink,
  type DocumentRow,
} from "@/lib/documents";

export const Route = createFileRoute("/_authenticated/admin/documents")({
  head: () => ({
    meta: [
      { title: "Documents — PGT CS Workbench" },
      { name: "description", content: "Registered source documents, candidate links and preserved raw files." },
      { property: "og:title", content: "Documents — PGT CS Workbench" },
      { property: "og:description", content: "Registered source documents, candidate links and preserved raw files." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DocumentsPage,
});

type Meta = {
  title: string;
  document_type: string;
  year: string;
  recruitment_cycle: string;
  subject: string;
  post_name: string;
  exam_id: string;
  source_domain_id: string;
  authority_level: string;
  verification_status: string;
  source_url: string;
  landing_page_url: string;
  publication_date: string;
  source_notes: string;
};

function DocumentsPage() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ q: "", exam: "", year: "", type: "", authority: "", verification: "", download: "", source: "" });
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState<{ mode: "approve" | "manual" | "edit"; candidateId?: string; docId?: string; meta: Meta } | null>(null);
  const [addUrl, setAddUrl] = useState("");
  const [inspection, setInspection] = useState<Awaited<ReturnType<typeof inspectUrl>> | null>(null);
  const runInspect = useServerFn(inspectUrl);
  const runDownload = useServerFn(downloadDocument);

  const exams = useQuery({
    queryKey: ["exams-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("exams").select("id,name").order("display_order");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const sources = useQuery({
    queryKey: ["source-domains"],
    queryFn: async () => {
      const { data, error } = await supabase.from("source_domains").select("*").order("priority").order("name");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const docs = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").order("discovered_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const files = useQuery({
    queryKey: ["document-files"],
    queryFn: async () => {
      const { data, error } = await supabase.from("document_files").select("*");
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const candidates = useQuery({
    queryKey: ["candidates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("candidate_links")
        .select("*")
        .eq("status", "pending")
        .order("confidence", { ascending: false })
        .limit(500);
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const examName = (id: string | null) => exams.data?.find((e) => e.id === id)?.name ?? "—";
  const sourceName = (id: string | null) => sources.data?.find((s) => s.id === id)?.name ?? "—";
  const fileFor = (d: DocumentRow) =>
    files.data?.find((f) => f.document_id === d.id) ??
    (d.duplicate_of_document_id ? files.data?.find((f) => f.document_id === d.duplicate_of_document_id) : undefined);

  const filtered = useMemo(() => {
    const q = filters.q.toLowerCase();
    return (docs.data ?? []).filter(
      (d) =>
        (!q || d.title.toLowerCase().includes(q) || d.source_url.toLowerCase().includes(q)) &&
        (!filters.exam || d.exam_id === filters.exam) &&
        (!filters.year || String(d.year ?? "") === filters.year) &&
        (!filters.type || d.document_type === filters.type) &&
        (!filters.authority || d.authority_level === filters.authority) &&
        (!filters.verification || d.verification_status === filters.verification) &&
        (!filters.download || d.download_status === filters.download) &&
        (!filters.source || d.source_domain_id === filters.source),
    );
  }, [docs.data, filters]);
  const years = [...new Set((docs.data ?? []).map((d) => d.year).filter(Boolean))].sort() as number[];

  const invalidateAll = () => {
    for (const k of ["documents", "document-files", "candidates", "collection-runs"]) qc.invalidateQueries({ queryKey: [k] });
  };

  const emptyMeta = (over: Partial<Meta> = {}): Meta => ({
    title: "",
    document_type: "other",
    year: "",
    recruitment_cycle: "",
    subject: "",
    post_name: "",
    exam_id: "",
    source_domain_id: "",
    authority_level: "unknown",
    verification_status: "unverified",
    source_url: "",
    landing_page_url: "",
    publication_date: "",
    source_notes: "",
    ...over,
  });

  const openApprove = (c: CandidateLink) => {
    const src = sources.data?.find((s) => s.id === c.source_domain_id);
    setEdit({
      mode: "approve",
      candidateId: c.id,
      meta: emptyMeta({
        title: c.anchor_text || c.url.split("/").pop() || c.url,
        document_type: c.possible_document_type ?? "other",
        year: c.possible_year ? String(c.possible_year) : "",
        exam_id: c.exam_id ?? "",
        source_domain_id: c.source_domain_id ?? "",
        authority_level: src?.authority_level ?? "unknown",
        source_url: c.url,
        landing_page_url: c.parent_page_url ?? "",
      }),
    });
  };

  const openEdit = (d: DocumentRow) =>
    setEdit({
      mode: "edit",
      docId: d.id,
      meta: emptyMeta({
        title: d.title,
        document_type: d.document_type,
        year: d.year ? String(d.year) : "",
        recruitment_cycle: d.recruitment_cycle ?? "",
        subject: d.subject ?? "",
        post_name: d.post_name ?? "",
        exam_id: d.exam_id ?? "",
        source_domain_id: d.source_domain_id ?? "",
        authority_level: d.authority_level,
        verification_status: d.verification_status,
        source_url: d.source_url,
        landing_page_url: d.landing_page_url ?? "",
        publication_date: d.publication_date ?? "",
        source_notes: d.source_notes ?? "",
      }),
    });

  const saveMeta = useMutation({
    mutationFn: async (e: NonNullable<typeof edit>) => {
      const m = e.meta;
      if (!m.title.trim()) throw new Error("Title is required");
      new URL(m.source_url);
      const payload = {
        title: m.title.trim(),
        document_type: m.document_type,
        year: m.year ? Number(m.year) : null,
        recruitment_cycle: m.recruitment_cycle.trim() || null,
        subject: m.subject.trim() || null,
        post_name: m.post_name.trim() || null,
        exam_id: m.exam_id || null,
        source_domain_id: m.source_domain_id || null,
        authority_level: m.authority_level,
        verification_status: m.verification_status,
        source_url: m.source_url.trim(),
        landing_page_url: m.landing_page_url.trim() || null,
        publication_date: m.publication_date || null,
        source_notes: m.source_notes.trim() || null,
      };
      if (e.mode === "edit") {
        const { error } = await supabase.from("documents").update(payload).eq("id", e.docId!);
        if (error) throw new Error(error.message);
        return;
      }
      const { data: doc, error } = await supabase
        .from("documents")
        .insert({ ...payload, download_status: "queued" })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (e.candidateId) {
        const { error: cErr } = await supabase
          .from("candidate_links")
          .update({ status: "approved", document_id: doc.id })
          .eq("id", e.candidateId);
        if (cErr) throw new Error(cErr.message);
      }
    },
    onSuccess: (_d, e) => {
      toast.success(e.mode === "edit" ? "Document updated" : "Document registered and queued for download");
      setEdit(null);
      setInspection(null);
      setAddUrl("");
      invalidateAll();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const ignore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("candidate_links").update({ status: "ignored" }).eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["candidates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const download = useMutation({
    mutationFn: (id: string) => runDownload({ data: { documentId: id } }),
    onSuccess: (r) => {
      if (r.status === "failed") toast.error(`Download failed: ${r.message}`);
      else toast.success(r.message);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const inspect = useMutation({
    mutationFn: (url: string) => runInspect({ data: { url } }),
    onSuccess: (r) => setInspection(r),
    onError: (e: Error) => toast.error(e.message),
  });

  async function openFile(path: string) {
    const { data, error } = await supabase.storage.from("source-documents").createSignedUrl(path, 300);
    if (error) return toast.error(error.message);
    window.open(data.signedUrl, "_blank", "noopener");
  }

  const open = docs.data?.find((d) => d.id === openId) ?? null;

  return (
    <AppShell title="Documents" description="Discover → register → download → hash → verify provenance → store">
      <Tabs defaultValue="documents">
        <TabsList>
          <TabsTrigger value="documents">Documents ({docs.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="candidates">Candidates ({candidates.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="add">Add URL</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Search title or URL"
              className="h-9 w-64"
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            />
            <Sel value={filters.exam} onChange={(v) => setFilters({ ...filters, exam: v })} all="All exams"
              options={(exams.data ?? []).map((e) => [e.id, e.name])} />
            <Sel value={filters.year} onChange={(v) => setFilters({ ...filters, year: v })} all="All years"
              options={years.map((y) => [String(y), String(y)])} />
            <Sel value={filters.type} onChange={(v) => setFilters({ ...filters, type: v })} all="All types"
              options={DOCUMENT_TYPES.map((t) => [t, DOCUMENT_TYPE_LABEL[t]!])} />
            <Sel value={filters.authority} onChange={(v) => setFilters({ ...filters, authority: v })} all="All authority"
              options={AUTHORITY_LEVELS.map((a) => [a, AUTHORITY_LABEL[a]!])} />
            <Sel value={filters.verification} onChange={(v) => setFilters({ ...filters, verification: v })} all="All verification"
              options={VERIFICATION.map((a) => [a, VERIFICATION_LABEL[a]!])} />
            <Sel value={filters.download} onChange={(v) => setFilters({ ...filters, download: v })} all="All download status"
              options={DOWNLOAD_STATUSES.map((a) => [a, DOWNLOAD_LABEL[a]!])} />
            <Sel value={filters.source} onChange={(v) => setFilters({ ...filters, source: v })} all="All sources"
              options={(sources.data ?? []).map((s) => [s.id, s.name])} />
          </div>
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Title</th>
                  <th className="px-3 py-2.5 font-medium">Exam</th>
                  <th className="px-3 py-2.5 font-medium">Year</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 font-medium">Source</th>
                  <th className="px-3 py-2.5 font-medium">Authority</th>
                  <th className="px-3 py-2.5 font-medium">Verification</th>
                  <th className="px-3 py-2.5 font-medium">Download</th>
                  <th className="px-3 py-2.5 font-medium">File</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      {docs.isLoading ? "Loading…" : "No documents registered yet. Approve a candidate or add a URL."}
                    </td>
                  </tr>
                )}
                {filtered.map((d) => {
                  const f = fileFor(d);
                  return (
                    <tr key={d.id} className="cursor-pointer border-b border-border last:border-b-0 hover:bg-secondary/50" onClick={() => setOpenId(d.id)}>
                      <td className="max-w-xs px-3 py-2.5 font-medium">{d.title}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{examName(d.exam_id)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{d.year ?? "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{DOCUMENT_TYPE_LABEL[d.document_type]}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{sourceName(d.source_domain_id)}</td>
                      <td className="px-3 py-2.5"><AuthorityBadge level={d.authority_level} /></td>
                      <td className="px-3 py-2.5"><StatusPill>{VERIFICATION_LABEL[d.verification_status]}</StatusPill></td>
                      <td className="px-3 py-2.5"><StatusPill>{DOWNLOAD_LABEL[d.download_status]}</StatusPill></td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{f ? formatBytes(f.file_size) : "No file"}</td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {d.download_status !== "downloaded" && d.download_status !== "skipped" && (
                          <Button size="sm" variant="outline" disabled={download.isPending} onClick={() => download.mutate(d.id)}>
                            <Download className="mr-1 h-3.5 w-3.5" /> {d.download_status === "failed" ? "Retry" : "Download"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="candidates" className="mt-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Links found by discovery. Year, type and confidence are keyword hints only — review each before approving.
          </p>
          <div className="overflow-x-auto rounded-md border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2.5 font-medium">Anchor text / URL</th>
                  <th className="px-3 py-2.5 font-medium">Parent page</th>
                  <th className="px-3 py-2.5 font-medium">File</th>
                  <th className="px-3 py-2.5 font-medium">Year?</th>
                  <th className="px-3 py-2.5 font-medium">Type?</th>
                  <th className="px-3 py-2.5 font-medium">Confidence</th>
                  <th className="px-3 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(candidates.data ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No pending candidates. Run discovery from Sources.
                    </td>
                  </tr>
                )}
                {candidates.data?.map((c) => (
                  <tr key={c.id} className="border-b border-border align-top last:border-b-0">
                    <td className="max-w-sm px-3 py-2.5">
                      <div className="font-medium">{c.anchor_text || "(no text)"}</div>
                      <a href={c.url} target="_blank" rel="noreferrer" className="break-all text-xs text-muted-foreground underline">{c.url}</a>
                    </td>
                    <td className="max-w-[12rem] break-all px-3 py-2.5 text-xs text-muted-foreground">{c.parent_page_url}</td>
                    <td className="px-3 py-2.5 uppercase text-muted-foreground">{c.detected_file_type ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.possible_year ?? "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{c.possible_document_type ? DOCUMENT_TYPE_LABEL[c.possible_document_type] : "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{Math.round(Number(c.confidence) * 100)}%</td>
                    <td className="px-3 py-2.5">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => openApprove(c)}>
                          <Check className="mr-1 h-3.5 w-3.5" /> Approve
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => ignore.mutate(c.id)}>
                          <EyeOff className="mr-1 h-3.5 w-3.5" /> Ignore
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="add" className="mt-4 max-w-2xl space-y-3">
          <p className="text-sm text-muted-foreground">
            Paste a URL. It is inspected to see whether it is a direct file, an HTML page, or unknown. Nothing is
            labelled as a question paper automatically.
          </p>
          <div className="flex gap-2">
            <Input placeholder="https://…" value={addUrl} onChange={(e) => setAddUrl(e.target.value)} />
            <Button disabled={!addUrl || inspect.isPending} onClick={() => inspect.mutate(addUrl)}>
              <Link2 className="mr-1.5 h-4 w-4" /> {inspect.isPending ? "Inspecting…" : "Inspect"}
            </Button>
          </div>
          {inspection && (
            <div className="rounded-md border border-border bg-card p-4 text-sm">
              <dl className="grid grid-cols-[10rem_1fr] gap-y-1.5">
                <dt className="text-muted-foreground">Detected as</dt>
                <dd className="font-medium">{inspection.kind === "direct_file" ? "Direct downloadable file" : inspection.kind === "html" ? "HTML page" : "Unknown"}</dd>
                <dt className="text-muted-foreground">HTTP status</dt><dd>{inspection.status ?? "—"}</dd>
                <dt className="text-muted-foreground">Content type</dt><dd>{inspection.contentType ?? "—"}</dd>
                <dt className="text-muted-foreground">Size</dt><dd>{formatBytes(inspection.contentLength)}</dd>
                <dt className="text-muted-foreground">Final URL</dt><dd className="break-all">{inspection.finalUrl}</dd>
                <dt className="text-muted-foreground">robots.txt</dt><dd>{inspection.robotsNote}</dd>
                {inspection.error && (<><dt className="text-destructive">Error</dt><dd className="text-destructive">{inspection.error}</dd></>)}
              </dl>
              <div className="mt-3">
                {inspection.kind === "html" ? (
                  <p className="text-muted-foreground">This is a web page. Register it under Sources and run Discover to find document links on it.</p>
                ) : (
                  <Button size="sm" disabled={!inspection.robotsAllowed}
                    onClick={() => setEdit({ mode: "manual", meta: emptyMeta({ source_url: inspection.finalUrl, title: inspection.finalUrl.split("/").pop() ?? "" }) })}>
                    Register as document
                  </Button>
                )}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {open && (
            <DocDetail
              doc={open}
              examName={examName(open.exam_id)}
              sourceName={sourceName(open.source_domain_id)}
              file={fileFor(open)}
              onOpenFile={openFile}
              onEdit={() => openEdit(open)}
            />
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{edit?.mode === "edit" ? "Edit document metadata" : "Register document"}</DialogTitle>
          </DialogHeader>
          {edit && (
            <MetaForm
              meta={edit.meta}
              onChange={(meta) => setEdit({ ...edit, meta })}
              exams={exams.data ?? []}
              sources={(sources.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button disabled={saveMeta.isPending} onClick={() => edit && saveMeta.mutate(edit)}>
              {edit?.mode === "edit" ? "Save" : "Approve & register"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Sel({ value, onChange, all, options }: { value: string; onChange: (v: string) => void; all: string; options: [string, string][] }) {
  return (
    <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{all}</option>
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

function MetaForm({ meta, onChange, exams, sources }: { meta: Meta; onChange: (m: Meta) => void; exams: { id: string; name: string }[]; sources: { id: string; name: string }[] }) {
  const set = (k: keyof Meta) => (v: string) => onChange({ ...meta, [k]: v });
  const text = (k: keyof Meta, label: string, type = "text") => (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={meta[k]} onChange={(e) => set(k)(e.target.value)} />
    </div>
  );
  const pick = (k: keyof Meta, label: string, opts: [string, string][], none?: string) => (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      <select className={selectClass} value={meta[k]} onChange={(e) => set(k)(e.target.value)}>
        {none !== undefined && <option value="">{none}</option>}
        {opts.map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
      </select>
    </div>
  );
  return (
    <div className="grid gap-3">
      {text("title", "Title")}
      {text("source_url", "Source URL")}
      {text("landing_page_url", "Landing page URL")}
      <div className="grid grid-cols-2 gap-3">
        {pick("document_type", "Document type", DOCUMENT_TYPES.map((t) => [t, DOCUMENT_TYPE_LABEL[t]!]))}
        {pick("exam_id", "Exam", exams.map((e) => [e.id, e.name]), "None")}
        {text("year", "Year", "number")}
        {text("recruitment_cycle", "Recruitment cycle")}
        {text("subject", "Subject")}
        {text("post_name", "Post")}
        {pick("source_domain_id", "Source", sources.map((s) => [s.id, s.name]), "None")}
        {text("publication_date", "Publication date", "date")}
        {pick("authority_level", "Authority", AUTHORITY_LEVELS.map((a) => [a, AUTHORITY_LABEL[a]!]))}
        {pick("verification_status", "Verification", VERIFICATION.map((a) => [a, VERIFICATION_LABEL[a]!]))}
      </div>
      <div className="grid gap-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea rows={3} value={meta.source_notes} onChange={(e) => set("source_notes")(e.target.value)} />
      </div>
    </div>
  );
}

function DocDetail({ doc, examName, sourceName, file, onOpenFile, onEdit }: {
  doc: DocumentRow; examName: string; sourceName: string;
  file: { storage_path: string; original_filename: string | null; page_count: number | null; file_size: number | null; mime_type: string | null } | undefined;
  onOpenFile: (path: string) => void; onEdit: () => void;
}) {
  const history = useQuery({
    queryKey: ["doc-history", doc.id],
    queryFn: async () => {
      const [runs, prov] = await Promise.all([
        supabase.from("collection_events").select("*").eq("document_id", doc.id).order("created_at", { ascending: false }),
        supabase.from("document_provenance").select("*").or(`document_id.eq.${doc.id}`),
      ]);
      if (runs.error) throw new Error(runs.error.message);
      if (prov.error) throw new Error(prov.error.message);
      return { events: runs.data, provenance: prov.data };
    },
  });
  const row = (k: string, v: React.ReactNode) => (
    <><dt className="text-muted-foreground">{k}</dt><dd className="break-all">{v ?? "—"}</dd></>
  );
  return (
    <div className="space-y-5 text-sm">
      <SheetHeader>
        <SheetTitle className="pr-6">{doc.title}</SheetTitle>
      </SheetHeader>
      <div className="flex flex-wrap items-center gap-2">
        <AuthorityBadge level={doc.authority_level} />
        <StatusPill>{VERIFICATION_LABEL[doc.verification_status]}</StatusPill>
        <StatusPill>{DOWNLOAD_LABEL[doc.download_status]}</StatusPill>
        <Button size="sm" variant="outline" className="ml-auto" onClick={onEdit}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
      </div>
      <dl className="grid grid-cols-[9rem_1fr] gap-y-1.5">
        {row("Source URL", <a className="underline" href={doc.source_url} target="_blank" rel="noreferrer">{doc.source_url}</a>)}
        {row("Landing page", doc.landing_page_url && <a className="underline" href={doc.landing_page_url} target="_blank" rel="noreferrer">{doc.landing_page_url}</a>)}
        {row("Source", sourceName)}
        {row("Exam", examName)}
        {row("Subject", doc.subject)}
        {row("Post", doc.post_name)}
        {row("Year", doc.year)}
        {row("Recruitment cycle", doc.recruitment_cycle)}
        {row("Type", DOCUMENT_TYPE_LABEL[doc.document_type])}
        {row("Publication date", doc.publication_date)}
        {row("Discovered", formatDate(doc.discovered_at))}
        {row("Downloaded", formatDate(doc.downloaded_at))}
        {row("MIME type", doc.mime_type)}
        {row("File size", formatBytes(doc.file_size))}
        {row("Page count", file?.page_count ?? "Unknown")}
        {row("SHA-256", doc.sha256 && <code className="text-xs">{doc.sha256}</code>)}
        {doc.duplicate_of_document_id && row("Duplicate of", <code className="text-xs">{doc.duplicate_of_document_id}</code>)}
        {row("Notes", doc.source_notes)}
      </dl>
      {file && (
        <Button size="sm" onClick={() => onOpenFile(file.storage_path)}>
          <ExternalLink className="mr-1.5 h-4 w-4" /> Open preserved file {file.original_filename ? `(${file.original_filename})` : ""}
        </Button>
      )}
      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Provenance</h3>
        {(history.data?.provenance ?? []).length === 0 ? <p className="text-muted-foreground">None recorded yet.</p> : (
          <ul className="space-y-1">{history.data!.provenance.map((p) => (<li key={p.id} className="break-all text-xs">{p.url}{p.notes && <span className="text-muted-foreground"> — {p.notes}</span>}</li>))}</ul>
        )}
      </div>
      <div>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Collection history</h3>
        {(history.data?.events ?? []).length === 0 ? <p className="text-muted-foreground">No collection attempts yet.</p> : (
          <ul className="space-y-1.5">{history.data!.events.map((e) => (
            <li key={e.id} className="text-xs">
              <span className={e.level === "error" ? "text-destructive" : e.level === "warning" ? "text-foreground" : "text-muted-foreground"}>[{e.level}]</span>{" "}
              {e.message} <span className="text-muted-foreground">· {formatDate(e.created_at)}</span>
            </li>))}</ul>
        )}
      </div>
    </div>
  );
}
