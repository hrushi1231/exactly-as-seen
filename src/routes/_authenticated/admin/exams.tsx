import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchExams, slugify, type Exam } from "@/lib/syllabus";

export const Route = createFileRoute("/_authenticated/admin/exams")({
  head: () => ({
    meta: [
      { title: "Exams — PGT CS Workbench" },
      { name: "description", content: "Manage examinations tracked by the preparation system." },
      { property: "og:title", content: "Exams — PGT CS Workbench" },
      {
        property: "og:description",
        content: "Manage examinations tracked by the preparation system.",
      },
    ],
  }),
  component: ExamsAdmin,
});

type Draft = {
  id?: string;
  name: string;
  slug: string;
  organization: string;
  post_name: string;
  subject_name: string;
  status: string;
  display_order: number;
  is_primary: boolean;
};

const emptyDraft: Draft = {
  name: "",
  slug: "",
  organization: "",
  post_name: "",
  subject_name: "",
  status: "active",
  display_order: 0,
  is_primary: false,
};

function ExamsAdmin() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<Exam | null>(null);

  const exams = useQuery({ queryKey: ["exams"], queryFn: fetchExams });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["exams"] });

  const save = useMutation({
    mutationFn: async (input: Draft) => {
      const payload = {
        name: input.name.trim(),
        slug: input.slug.trim() || slugify(input.name),
        organization: input.organization.trim() || null,
        post_name: input.post_name.trim() || null,
        subject_name: input.subject_name.trim() || null,
        status: input.status,
        display_order: Number(input.display_order) || 0,
        is_primary: input.is_primary,
      };
      if (!payload.name) throw new Error("Name is required");

      if (payload.is_primary) {
        const { error: clearError } = await supabase
          .from("exams")
          .update({ is_primary: false })
          .eq("is_primary", true)
          .neq("id", input.id ?? "00000000-0000-0000-0000-000000000000");
        if (clearError) throw new Error(clearError.message);
      }

      const query = input.id
        ? supabase.from("exams").update(payload).eq("id", input.id)
        : supabase.from("exams").insert(payload);
      const { error } = await query;
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Exam saved");
      setDraft(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (exam: Exam) => {
      const { error } = await supabase.from("exams").delete().eq("id", exam.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Exam deleted");
      setDeleting(null);
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const makePrimary = useMutation({
    mutationFn: async (exam: Exam) => {
      const { error: clearError } = await supabase
        .from("exams")
        .update({ is_primary: false })
        .eq("is_primary", true);
      if (clearError) throw new Error(clearError.message);
      const { error } = await supabase
        .from("exams")
        .update({ is_primary: true })
        .eq("id", exam.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Primary exam updated");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell
      title="Exams"
      description="Examinations tracked by the system"
      actions={
        <Button size="sm" onClick={() => setDraft({ ...emptyDraft })}>
          <Plus className="mr-1.5 h-4 w-4" /> New exam
        </Button>
      }
    >
      <div className="overflow-hidden rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Exam</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Organization</th>
              <th className="hidden px-4 py-2.5 font-medium lg:table-cell">Post</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {exams.isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-muted-foreground">
                  Loading exams…
                </td>
              </tr>
            )}
            {exams.data?.map((exam) => (
              <tr key={exam.id} className="border-b border-border last:border-b-0">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{exam.name}</span>
                    {exam.is_primary && (
                      <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{exam.slug}</div>
                </td>
                <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                  {exam.organization ?? "—"}
                </td>
                <td className="hidden px-4 py-2.5 text-muted-foreground lg:table-cell">
                  {exam.post_name ?? "—"}
                </td>
                <td className="px-4 py-2.5 capitalize text-muted-foreground">{exam.status}</td>
                <td className="px-4 py-2.5">
                  <div className="flex justify-end gap-1">
                    {!exam.is_primary && (
                      <button
                        title="Set as primary"
                        className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                        onClick={() => makePrimary.mutate(exam)}
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      title="Edit"
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      onClick={() =>
                        setDraft({
                          id: exam.id,
                          name: exam.name,
                          slug: exam.slug,
                          organization: exam.organization ?? "",
                          post_name: exam.post_name ?? "",
                          subject_name: exam.subject_name ?? "",
                          status: exam.status,
                          display_order: exam.display_order,
                          is_primary: exam.is_primary,
                        })
                      }
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      title="Delete"
                      className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-destructive"
                      onClick={() => setDeleting(exam)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!exams.isLoading && (exams.data?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No exams yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit exam" : "New exam"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={draft.name}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      name: e.target.value,
                      slug: draft.id ? draft.slug : slugify(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={draft.slug}
                  onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="org">Organization</Label>
                  <Input
                    id="org"
                    value={draft.organization}
                    onChange={(e) => setDraft({ ...draft, organization: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="post">Post</Label>
                  <Input
                    id="post"
                    value={draft.post_name}
                    onChange={(e) => setDraft({ ...draft, post_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={draft.subject_name}
                    onChange={(e) => setDraft({ ...draft, subject_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="order">Display order</Label>
                  <Input
                    id="order"
                    type="number"
                    value={draft.display_order}
                    onChange={(e) =>
                      setDraft({ ...draft, display_order: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[var(--primary)]"
                  checked={draft.is_primary}
                  onChange={(e) => setDraft({ ...draft, is_primary: e.target.checked })}
                />
                Primary examination
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button onClick={() => draft && save.mutate(draft)} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the exam and its syllabus mappings. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleting && remove.mutate(deleting)}
              disabled={remove.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
