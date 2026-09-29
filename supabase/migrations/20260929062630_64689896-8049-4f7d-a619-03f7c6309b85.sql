CREATE TABLE public.pyq_research_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  post_type text NOT NULL CHECK (post_type IN ('pgt_computer_science','computer_teacher')),
  year int NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  search_status text NOT NULL DEFAULT 'not_started' CHECK (search_status IN ('not_started','searching','partial','exhaustive','needs_review')),
  evidence_status text NOT NULL DEFAULT 'unknown' CHECK (evidence_status IN ('unknown','no_exam_evidence','exam_held_paper_not_found','paper_found','memory_based_only')),
  queries_run int NOT NULL DEFAULT 0,
  candidate_count int NOT NULL DEFAULT 0,
  official_candidates int NOT NULL DEFAULT 0,
  secondary_candidates int NOT NULL DEFAULT 0,
  video_candidates int NOT NULL DEFAULT 0,
  paper_found boolean NOT NULL DEFAULT false,
  answer_key_found boolean NOT NULL DEFAULT false,
  response_sheet_found boolean NOT NULL DEFAULT false,
  last_searched_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exam_id, post_type, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pyq_research_cycles TO authenticated;
GRANT ALL ON public.pyq_research_cycles TO service_role;
ALTER TABLE public.pyq_research_cycles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cycles_admin_all" ON public.pyq_research_cycles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.discovery_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.pyq_research_cycles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  query text NOT NULL,
  query_kind text NOT NULL,
  result_count int NOT NULL DEFAULT 0,
  error text,
  ran_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_queries TO authenticated;
GRANT ALL ON public.discovery_queries TO service_role;
ALTER TABLE public.discovery_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dq_admin_all" ON public.discovery_queries FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.discovery_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_url text NOT NULL UNIQUE,
  url text NOT NULL,
  title text,
  snippet text,
  source_domain text NOT NULL,
  source_kind text NOT NULL DEFAULT 'web' CHECK (source_kind IN ('web','pdf','youtube','telegram','scribd','government','blog','prep_site','archive')),
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  post_type_guess text NOT NULL DEFAULT 'unknown' CHECK (post_type_guess IN ('pgt_computer_science','computer_teacher','unknown')),
  year_guess int,
  artifact_type_guess text NOT NULL DEFAULT 'unknown' CHECK (artifact_type_guess IN ('question_paper','answer_key','response_sheet','question_video','memory_based_questions','solved_questions','syllabus','exam_notice','exam_schedule','cutoff','result','unknown')),
  authority_guess text NOT NULL DEFAULT 'unknown' CHECK (authority_guess IN ('official','secondary','memory_based','unknown')),
  confidence numeric NOT NULL DEFAULT 0,
  is_downloadable boolean NOT NULL DEFAULT false,
  video_channel text,
  video_published_at text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','ignored','sent')),
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  discovery_queries text[] NOT NULL DEFAULT '{}',
  cycle_ids uuid[] NOT NULL DEFAULT '{}',
  provider text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX discovery_candidates_year_idx ON public.discovery_candidates(year_guess);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.discovery_candidates TO authenticated;
GRANT ALL ON public.discovery_candidates TO service_role;
ALTER TABLE public.discovery_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dc_admin_all" ON public.discovery_candidates FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS post_type text;

INSERT INTO public.pyq_research_cycles (exam_id, post_type, year)
SELECT e.id, p, y FROM public.exams e, unnest(ARRAY['pgt_computer_science','computer_teacher']) p, generate_series(2018,2025) y
WHERE e.slug='oavs-pgt-cs' ON CONFLICT DO NOTHING;