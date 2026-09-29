import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Pencil, Plus, Radar } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AuthorityBadge } from "@/components/authority-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { discoverLinks } from "@/lib/collector.functions";
import { AUTHORITY_LABEL, AUTHORITY_LEVELS, selectClass, type SourceDomain } from "@/lib/documents";

export const Route = createFileRoute("/_authenticated/admin/sources")({
  head: () => ({
    meta: [
      { title: "Sources — PGT CS Workbench" },
      { name: "description", content: "Registry of websites used to collect exam source documents." },
      { property: "og:title", content: "Sources — PGT CS Workbench" },
      { property: "og:description", content: "Registry of websites used to collect exam source documents." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SourcesPage,
});

type Draft = {
  id?: string;
  name: string;
  base_url: string;
  organization: string;
  exam_id: string;
  source_type: string;
  authority_level: string;
  priority: string;
  is_active: boolean;
  crawl_notes: string;
  robots_notes: string;
};
const empty: Draft = {
  name: "",
  base_url: "",
  organization: "",
  exam_id: "",
  source_type: "official_website",
  authority_level: "unknown",
  priority: "B",
  is_active: true,
  crawl_notes: "",
  robots_notes: "",
};

function SourcesPage() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [discover, setDiscover] = useState<{ source: SourceDomain; url: string } | null>(null);
  const runDiscover = useServerFn(discoverLinks);

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
  const examName = (id: string | null) => exams.data?.find((e) => e.id === id)?.name ?? "—";

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!d.name.trim() || !d.base_url.trim()) throw new Error("Name and URL are required");
      new URL(d.base_url);
      const payload = {
        name: d.name.trim(),
        base_url: d.base_url.trim(),
        organization: d.organization.trim() || null,
        exam_id: d.exam_id || null,
        source_type: d.source_type.trim() || "website",
        authority_level: d.authority_level,
        priority: d.priority,
        is_active: d.is_active,
        crawl_notes: d.crawl_notes.trim() || null,
        robots_notes: d.robots_notes.trim() || null,
      };
      const { error } = d.id
        ? await supabase.from("source_domains").update(payload).eq("id", d.id)
        : await supabase.from("source_domains").insert(payload);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Source saved");
      setDraft(null);
      qc.invalidateQueries({ queryKey: ["source-domains"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (s: SourceDomain) => {
      const { error } = await supabase.from("source_domains").update({ is_active: !s.is_active }).eq("id", s.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["source-domains"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const discovery = useMutation({
    mutationFn: (v: { source: SourceDomain; url: string }) =>
      runDiscover({
        data: { url: v.url, sourceDomainId: v.source.id, examId: v.source.exam_id, strategy: "static_html" },
      }),
    onSuccess: (r) => {
      if (r.status === "succeeded") toast.success(r.message);
      else toast.error(r.message);
      setDiscover(null);
      qc.invalidateQueries({ queryKey: ["candidates"] });
      qc.invalidateQueries({ queryKey: ["collection-runs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title="Sources"
      description="Websites registered for document collection"
      actions={
        <Button size="sm" onClick={() => setDraft({ ...empty })}>
          <Plus className="mr-1.5 h-4 w-4" /> New source
        </Button>
      }
    >
      <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
        Priority A = official exam bodies, B = reputable secondary sources, C = memory-based sources. Discovery
        only reads publicly accessible pages, checks robots.txt, and never bypasses logins, paywalls or CAPTCHAs.
        Found links are stored as candidates for your review — see{" "}
        <Link to="/admin/documents" className="underline">
          Documents → Candidates
        </Link>
        .
      </p>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="px-4 py-2.5 font-medium">Exam</th>
              <th className="px-4 py-2.5 font-medium">Authority</th>
              <th className="px-4 py-2.5 font-medium">Priority</th>
              <th className="px-4 py-2.5 font-medium">Active</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sources.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {sources.data?.map((s) => (
              <tr key={s.id} className="border-b border-border align-top last:border-b-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{s.name}</div>
                  <a href={s.base_url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground underline">
                    {s.base_url}
                  </a>
                  {s.organization && <div className="text-xs text-muted-foreground">{s.organization}</div>}
                  {s.crawl_notes && <div className="mt-1 max-w-md text-xs text-muted-foreground">{s.crawl_notes}</div>}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{examName(s.exam_id)}</td>
                <td className="px-4 py-2.5">
                  <AuthorityBadge level={s.authority_level} />
                </td>
                <td className="px-4 py-2.5">{s.priority}</td>
                <td className="px-4 py-2.5">
                  <Switch checked={s.is_active} onCheckedChange={() => toggle.mutate(s)} aria-label="Toggle active" />
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!s.is_active}
                      onClick={() => setDiscover({ source: s, url: s.base_url })}
                    >
                      <Radar className="mr-1 h-3.5 w-3.5" /> Discover
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Edit source"
                      onClick={() =>
                        setDraft({
                          id: s.id,
                          name: s.name,
                          base_url: s.base_url,
                          organization: s.organization ?? "",
                          exam_id: s.exam_id ?? "",
                          source_type: s.source_type,
                          authority_level: s.authority_level,
                          priority: s.priority,
                          is_active: s.is_active,
                          crawl_notes: s.crawl_notes ?? "",
                          robots_notes: s.robots_notes ?? "",
                        })
                      }
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit source" : "New source"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="grid gap-3">
              <Field label="Name">
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
              </Field>
              <Field label="Base URL">
                <Input value={draft.base_url} onChange={(e) => setDraft({ ...draft, base_url: e.target.value })} />
              </Field>
              <Field label="Organization">
                <Input value={draft.organization} onChange={(e) => setDraft({ ...draft, organization: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Exam">
                  <select className={selectClass} value={draft.exam_id} onChange={(e) => setDraft({ ...draft, exam_id: e.target.value })}>
                    <option value="">None / multiple</option>
                    {exams.data?.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Source type">
                  <Input value={draft.source_type} onChange={(e) => setDraft({ ...draft, source_type: e.target.value })} />
                </Field>
                <Field label="Authority">
                  <select
                    className={selectClass}
                    value={draft.authority_level}
                    onChange={(e) => setDraft({ ...draft, authority_level: e.target.value })}
                  >
                    {AUTHORITY_LEVELS.map((a) => (
                      <option key={a} value={a}>
                        {AUTHORITY_LABEL[a]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Priority">
                  <select className={selectClass} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
                    <option value="A">A — official</option>
                    <option value="B">B — secondary</option>
                    <option value="C">C — memory-based</option>
                  </select>
                </Field>
              </div>
              <Field label="Crawl notes">
                <Textarea rows={2} value={draft.crawl_notes} onChange={(e) => setDraft({ ...draft, crawl_notes: e.target.value })} />
              </Field>
              <Field label="Robots / access notes">
                <Textarea rows={2} value={draft.robots_notes} onChange={(e) => setDraft({ ...draft, robots_notes: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={draft.is_active} onCheckedChange={(v) => setDraft({ ...draft, is_active: v })} /> Active
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!discover} onOpenChange={(o) => !o && !discovery.isPending && setDiscover(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Discover documents — {discover?.source.name}</DialogTitle>
          </DialogHeader>
          {discover && (
            <div className="grid gap-3 text-sm">
              <Field label="Page to scan (static HTML)">
                <Input value={discover.url} onChange={(e) => setDiscover({ ...discover, url: e.target.value })} />
              </Field>
              <p className="text-xs text-muted-foreground">
                Enter the specific recruitment/notice page for best results. Only links to document files are
                recorded, as candidates — nothing is downloaded or labelled as a question paper automatically.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={discovery.isPending} onClick={() => setDiscover(null)}>
              Cancel
            </Button>
            <Button disabled={discovery.isPending} onClick={() => discover && discovery.mutate(discover)}>
              {discovery.isPending ? "Scanning…" : "Scan page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
