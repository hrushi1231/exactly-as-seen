import { Fragment, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { StatusPill } from "@/components/authority-badge";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/documents";

export const Route = createFileRoute("/_authenticated/admin/collection-runs")({
  head: () => ({
    meta: [
      { title: "Collection runs — PGT CS Workbench" },
      { name: "description", content: "Audit log of every document discovery and download attempt." },
      { property: "og:title", content: "Collection runs — PGT CS Workbench" },
      { property: "og:description", content: "Audit log of every document discovery and download attempt." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RunsPage,
});

const STRATEGY: Record<string, string> = {
  direct_file: "Direct file",
  static_html: "Static HTML",
  browser: "Browser (worker)",
  inspect: "Inspect",
};

function RunsPage() {
  const [open, setOpen] = useState<string | null>(null);
  const runs = useQuery({
    queryKey: ["collection-runs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collection_runs")
        .select("*, source_domains(name)")
        .order("started_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return data;
    },
  });
  const events = useQuery({
    queryKey: ["collection-events", open],
    enabled: !!open,
    queryFn: async () => {
      const { data, error } = await supabase.from("collection_events").select("*").eq("run_id", open!).order("created_at");
      if (error) throw new Error(error.message);
      return data;
    },
  });

  return (
    <AppShell title="Collection runs" description="Every discovery and download attempt, with errors">
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="w-6 px-3 py-2.5" />
              <th className="px-3 py-2.5 font-medium">Started</th>
              <th className="px-3 py-2.5 font-medium">Source / target</th>
              <th className="px-3 py-2.5 font-medium">Strategy</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Links</th>
              <th className="px-3 py-2.5 text-right font-medium">Docs +/~</th>
              <th className="px-3 py-2.5 text-right font-medium">Files</th>
              <th className="px-3 py-2.5 text-right font-medium">Dupes</th>
              <th className="px-3 py-2.5 text-right font-medium">Errors</th>
            </tr>
          </thead>
          <tbody>
            {(runs.data ?? []).length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                  {runs.isLoading ? "Loading…" : "No collection runs yet."}
                </td>
              </tr>
            )}
            {runs.data?.map((r) => (
              <Fragment key={r.id}>
                <tr className="cursor-pointer border-b border-border hover:bg-secondary/50" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {open === r.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDate(r.started_at)}</td>
                  <td className="max-w-sm px-3 py-2.5">
                    <div className="font-medium">{r.source_domains?.name ?? "Manual"}</div>
                    <div className="break-all text-xs text-muted-foreground">{r.target_url}</div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{STRATEGY[r.strategy]}</td>
                  <td className="px-3 py-2.5">
                    <span className={r.status === "failed" ? "text-destructive" : ""}>
                      <StatusPill>{r.status.replace("_", " ")}</StatusPill>
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">{r.links_discovered}</td>
                  <td className="px-3 py-2.5 text-right">{r.documents_created}/{r.documents_updated}</td>
                  <td className="px-3 py-2.5 text-right">{r.files_downloaded}</td>
                  <td className="px-3 py-2.5 text-right">{r.duplicates_detected}</td>
                  <td className={`px-3 py-2.5 text-right ${r.errors ? "font-medium text-destructive" : ""}`}>{r.errors}</td>
                </tr>
                {open === r.id && (
                  <tr className="border-b border-border bg-muted/40">
                    <td />
                    <td colSpan={9} className="px-3 py-3">
                      {events.isLoading ? (
                        <p className="text-xs text-muted-foreground">Loading events…</p>
                      ) : (
                        <ul className="space-y-1 text-xs">
                          {events.data?.map((e) => (
                            <li key={e.id}>
                              <span className={e.level === "error" ? "font-medium text-destructive" : "text-muted-foreground"}>[{e.level}]</span>{" "}
                              {e.message}
                              {e.url && <span className="break-all text-muted-foreground"> — {e.url}</span>}
                            </li>
                          ))}
                          {r.finished_at && <li className="text-muted-foreground">Finished {formatDate(r.finished_at)}</li>}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
