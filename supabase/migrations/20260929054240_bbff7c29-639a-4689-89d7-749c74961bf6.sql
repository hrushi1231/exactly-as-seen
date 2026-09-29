CREATE TABLE public.source_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_url text NOT NULL UNIQUE,
  organization text,
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  source_type text NOT NULL DEFAULT 'official_website',
  authority_level text NOT NULL DEFAULT 'unknown' CHECK (authority_level IN ('official','secondary','memory_based','unknown')),
  priority text NOT NULL DEFAULT 'A' CHECK (priority IN ('A','B','C')),
  is_active boolean NOT NULL DEFAULT true,
  crawl_notes text,
  robots_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.source_domains TO authenticated;
GRANT ALL ON public.source_domains TO service_role;
ALTER TABLE public.source_domains ENABLE ROW LEVEL SECURITY;
CREATE POLICY source_domains_admin ON public.source_domains FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER source_domains_updated_at BEFORE UPDATE ON public.source_domains FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  source_domain_id uuid REFERENCES public.source_domains(id) ON DELETE SET NULL,
  title text NOT NULL,
  document_type text NOT NULL DEFAULT 'other' CHECK (document_type IN ('syllabus','question_paper','answer_key','response_sheet','notification','exam_pattern','memory_based_paper','other')),
  year integer,
  recruitment_cycle text,
  subject text,
  post_name text,
  source_url text NOT NULL,
  landing_page_url text,
  publication_date date,
  authority_level text NOT NULL DEFAULT 'unknown' CHECK (authority_level IN ('official','secondary','memory_based','unknown')),
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','verified','needs_review')),
  download_status text NOT NULL DEFAULT 'discovered' CHECK (download_status IN ('discovered','queued','downloaded','failed','skipped')),
  sha256 text,
  mime_type text,
  file_size bigint,
  duplicate_of_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  source_notes text,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  downloaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX documents_sha_idx ON public.documents(sha256);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_admin ON public.documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.document_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  original_filename text,
  storage_path text NOT NULL,
  mime_type text,
  sha256 text NOT NULL UNIQUE,
  file_size bigint,
  page_count integer,
  text_extractable boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_files TO authenticated;
GRANT ALL ON public.document_files TO service_role;
ALTER TABLE public.document_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_files_admin ON public.document_files FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.document_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  source_domain_id uuid REFERENCES public.source_domains(id) ON DELETE SET NULL,
  url text NOT NULL,
  landing_page_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.document_provenance TO authenticated;
GRANT ALL ON public.document_provenance TO service_role;
ALTER TABLE public.document_provenance ENABLE ROW LEVEL SECURITY;
CREATE POLICY document_provenance_admin ON public.document_provenance FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.collection_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_domain_id uuid REFERENCES public.source_domains(id) ON DELETE SET NULL,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  target_url text,
  strategy text NOT NULL CHECK (strategy IN ('direct_file','static_html','browser','inspect')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed','partial','requires_worker')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  links_discovered integer NOT NULL DEFAULT 0,
  documents_created integer NOT NULL DEFAULT 0,
  documents_updated integer NOT NULL DEFAULT 0,
  files_downloaded integer NOT NULL DEFAULT 0,
  duplicates_detected integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  triggered_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_runs TO authenticated;
GRANT ALL ON public.collection_runs TO service_role;
ALTER TABLE public.collection_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY collection_runs_admin ON public.collection_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.collection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.collection_runs(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info','warning','error')),
  message text NOT NULL,
  url text,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_events TO authenticated;
GRANT ALL ON public.collection_events TO service_role;
ALTER TABLE public.collection_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY collection_events_admin ON public.collection_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.candidate_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.collection_runs(id) ON DELETE SET NULL,
  source_domain_id uuid REFERENCES public.source_domains(id) ON DELETE SET NULL,
  exam_id uuid REFERENCES public.exams(id) ON DELETE SET NULL,
  anchor_text text,
  url text NOT NULL,
  parent_page_url text,
  detected_file_type text,
  possible_year integer,
  possible_document_type text,
  confidence numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','ignored')),
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (url, parent_page_url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.candidate_links TO authenticated;
GRANT ALL ON public.candidate_links TO service_role;
ALTER TABLE public.candidate_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY candidate_links_admin ON public.candidate_links FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER candidate_links_updated_at BEFORE UPDATE ON public.candidate_links FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Security review fixes
REVOKE EXECUTE ON FUNCTION public._import_syllabus(jsonb, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.claim_first_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_first_admin() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.import_syllabus(jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_syllabus(jsonb, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.syllabus_validation() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.syllabus_validation() TO authenticated;

-- Seed official source domains (no document records)
INSERT INTO public.source_domains (name, base_url, organization, exam_id, source_type, authority_level, priority, crawl_notes) VALUES
('OAVS official website','https://oav.edu.in/','Odisha Adarsha Vidyalaya Sangathan',(SELECT id FROM exams WHERE slug='oavs-pgt-cs'),'official_website','official','A','Recruitment notices and syllabus annexures. Confirm the recruitment page URL before discovery.'),
('SSB Odisha official website','https://ssbodisha.ac.in/','State Selection Board, Odisha',(SELECT id FROM exams WHERE slug='ssb-odisha-pgt-cs'),'official_website','official','A','PGT advertisements, answer keys and question booklets are published under notices.'),
('KVS official website','https://kvsangathan.nic.in/','Kendriya Vidyalaya Sangathan',(SELECT id FROM exams WHERE slug='kvs-pgt-cs'),'official_website','official','A','Recruitment section; older papers may be archived or unavailable.'),
('NVS official website','https://navodaya.gov.in/','Navodaya Vidyalaya Samiti',(SELECT id FROM exams WHERE slug='nvs-pgt-cs'),'official_website','official','A','Recruitment notices; site is partly JavaScript-rendered and may need the browser worker.'),
('EMRS / NESTS official website','https://nests.tribal.gov.in/','National Education Society for Tribal Students',(SELECT id FROM exams WHERE slug='emrs-pgt-cs'),'official_website','official','A','EMRS staff selection exam notices and answer keys.');