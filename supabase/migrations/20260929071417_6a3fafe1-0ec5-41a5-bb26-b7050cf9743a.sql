ALTER TABLE public.discovery_candidates
  ADD COLUMN resolution_status text NOT NULL DEFAULT 'unresolved' CHECK (resolution_status IN ('unresolved','relevant','irrelevant','auto_irrelevant','wrong_post','wrong_year','index_page','artifact_found','blocked','dead_link')),
  ADD COLUMN resolution_reason text,
  ADD COLUMN resolution_score int,
  ADD COLUMN resolved_at timestamptz,
  ADD COLUMN depth int NOT NULL DEFAULT 0,
  ADD COLUMN parent_candidate_id uuid REFERENCES public.discovery_candidates(id) ON DELETE SET NULL,
  ADD COLUMN page_title text,
  ADD COLUMN publication_date text,
  ADD COLUMN post_matches text[] NOT NULL DEFAULT '{}',
  ADD COLUMN year_value int,
  ADD COLUMN year_confidence text CHECK (year_confidence IN ('high','medium','low')),
  ADD COLUMN year_evidence text,
  ADD COLUMN advertisement_numbers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN exam_dates text[] NOT NULL DEFAULT '{}',
  ADD COLUMN resolved_artifact_type text CHECK (resolved_artifact_type IN ('question_paper','answer_key','final_answer_key','provisional_answer_key','response_sheet','exam_schedule','recruitment_notice','syllabus','memory_based_questions','solved_questions','video_reconstruction','other')),
  ADD COLUMN authority text NOT NULL DEFAULT 'unknown' CHECK (authority IN ('official','official_mirror','reputable_secondary','community','unknown')),
  ADD COLUMN video_id text,
  ADD COLUMN video_duration_seconds int,
  ADD COLUMN video_description text,
  ADD COLUMN captions_available boolean,
  ADD COLUMN video_class text CHECK (video_class IN ('official','secondary_explanation','memory_based_pyq','paper_walkthrough','unrelated','unknown')),
  ADD COLUMN file_checks jsonb;

CREATE TABLE public.exam_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  label text NOT NULL,
  recruitment_cycle int,
  advertisement_number text,
  exam_date text,
  exam_year int,
  pgt_cs_status text NOT NULL DEFAULT 'unknown' CHECK (pgt_cs_status IN ('unknown','recruitment_found','exam_scheduled','exam_confirmed','post_not_included','no_exam_evidence')),
  computer_teacher_status text NOT NULL DEFAULT 'unknown' CHECK (computer_teacher_status IN ('unknown','recruitment_found','exam_scheduled','exam_confirmed','post_not_included','no_exam_evidence')),
  pgt_cs_evidence_url text,
  computer_teacher_evidence_url text,
  notes text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_cycles TO authenticated;
GRANT ALL ON public.exam_cycles TO service_role;
ALTER TABLE public.exam_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_cycles_admin" ON public.exam_cycles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.evidence_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES public.exam_cycles(id) ON DELETE CASCADE,
  post_type text CHECK (post_type IN ('pgt_computer_science','computer_teacher')),
  claim text NOT NULL,
  claim_type text NOT NULL CHECK (claim_type IN ('recruitment','exam_scheduled','exam_held','post_included','post_not_included','artifact_identity')),
  source_url text NOT NULL,
  authority text NOT NULL DEFAULT 'unknown' CHECK (authority IN ('official','official_mirror','reputable_secondary','community','unknown')),
  candidate_id uuid REFERENCES public.discovery_candidates(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  excerpt text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, post_type, claim_type, source_url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.evidence_claims TO authenticated;
GRANT ALL ON public.evidence_claims TO service_role;
ALTER TABLE public.evidence_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "evidence_admin" ON public.evidence_claims FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.gold_corpus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid REFERENCES public.exam_cycles(id) ON DELETE SET NULL,
  post_type text NOT NULL CHECK (post_type IN ('pgt_computer_science','computer_teacher')),
  artifact_type text NOT NULL,
  quality_level text NOT NULL CHECK (quality_level IN ('A','B','C','D')),
  candidate_id uuid REFERENCES public.discovery_candidates(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  url text NOT NULL,
  title text,
  reason text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (url, post_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gold_corpus TO authenticated;
GRANT ALL ON public.gold_corpus TO service_role;
ALTER TABLE public.gold_corpus ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gold_admin" ON public.gold_corpus FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES public.exam_cycles(id) ON DELETE SET NULL;