-- Phase 04A: video PYQ reconstruction
CREATE TABLE public.video_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL UNIQUE,
  canonical_url text NOT NULL,
  candidate_id uuid REFERENCES public.discovery_candidates(id) ON DELETE SET NULL,
  post_type text NOT NULL CHECK (post_type IN ('pgt_computer_science','computer_teacher')),
  title text, channel text, channel_id text,
  video_publish_date timestamptz,
  duration_seconds integer, description text, thumbnail_url text,
  captions_available boolean, caption_languages text[] NOT NULL DEFAULT '{}', auto_caption_languages text[] NOT NULL DEFAULT '{}',
  metadata_status text NOT NULL DEFAULT 'pending' CHECK (metadata_status IN ('pending','resolved','failed')),
  metadata_error text,
  claimed_exam_year integer, claimed_exam_year_evidence text,
  resolved_cycle_id uuid REFERENCES public.exam_cycles(id) ON DELETE SET NULL,
  exam_year_confidence text NOT NULL DEFAULT 'none' CHECK (exam_year_confidence IN ('high','medium','low','none')),
  exam_year_evidence text,
  pyq_claim text NOT NULL DEFAULT 'UNKNOWN' CHECK (pyq_claim IN ('ACTUAL_PYQ_CLAIM','PRACTICE_QUESTION','MODEL_QUESTION','EXPLANATION_ONLY','UNKNOWN')),
  pyq_claim_evidence text,
  processing_status text NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending','processing','processed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_sources TO authenticated;
GRANT ALL ON public.video_sources TO service_role;
ALTER TABLE public.video_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_sources_admin" ON public.video_sources FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER video_sources_updated_at BEFORE UPDATE ON public.video_sources FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.video_processing_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_source_id uuid NOT NULL REFERENCES public.video_sources(id) ON DELETE CASCADE,
  worker_version text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed')),
  transcript_source text CHECK (transcript_source IN ('youtube_captions','whisper','none')),
  transcript_language text,
  frames_candidate integer NOT NULL DEFAULT 0,
  frames_ocr integer NOT NULL DEFAULT 0,
  candidates_found integer NOT NULL DEFAULT 0,
  steps jsonb NOT NULL DEFAULT '[]',
  error text,
  started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_processing_runs TO authenticated;
GRANT ALL ON public.video_processing_runs TO service_role;
ALTER TABLE public.video_processing_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "video_runs_admin" ON public.video_processing_runs FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  source_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'mcq_single' CHECK (question_type IN ('mcq_single','mcq_multi','numeric','descriptive','unknown')),
  language text NOT NULL DEFAULT 'en',
  normalization_status text NOT NULL DEFAULT 'raw' CHECK (normalization_status IN ('raw','auto_normalized','admin_edited')),
  verification_status text NOT NULL DEFAULT 'RAW_RECONSTRUCTION' CHECK (verification_status IN ('RAW_RECONSTRUCTION','NEEDS_REVIEW','VIDEO_RECONSTRUCTED','CROSS_SOURCE_RECONSTRUCTED','VERIFIED_SECONDARY','OFFICIAL_VERIFIED','REJECTED')),
  pyq_claim text NOT NULL DEFAULT 'UNKNOWN' CHECK (pyq_claim IN ('ACTUAL_PYQ_CLAIM','PRACTICE_QUESTION','MODEL_QUESTION','EXPLANATION_ONLY','UNKNOWN')),
  answer_label text,
  answer_status text NOT NULL DEFAULT 'NONE' CHECK (answer_status IN ('PRESENTER_STATED','PRESENTER_VISUAL','OFFICIAL','NONE')),
  quality_flags text[] NOT NULL DEFAULT '{}',
  confidence numeric NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  merged_into_id uuid REFERENCES public.questions(id) ON DELETE SET NULL,
  reviewed_by uuid, reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions_admin" ON public.questions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.question_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  label text NOT NULL,
  option_text text NOT NULL,
  raw_text text,
  display_order integer NOT NULL DEFAULT 0,
  is_presented_answer boolean NOT NULL DEFAULT false,
  UNIQUE (question_id, label)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_options TO authenticated;
GRANT ALL ON public.question_options TO service_role;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "question_options_admin" ON public.question_options FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.question_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id),
  post_type text NOT NULL CHECK (post_type IN ('pgt_computer_science','computer_teacher')),
  resolved_cycle_id uuid REFERENCES public.exam_cycles(id) ON DELETE SET NULL,
  exam_year integer,
  question_number integer,
  source_video_id uuid NOT NULL REFERENCES public.video_sources(id) ON DELETE CASCADE,
  source_timestamp_start numeric NOT NULL,
  source_timestamp_end numeric,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  topic_id uuid REFERENCES public.topics(id) ON DELETE SET NULL,
  subtopic_id uuid REFERENCES public.subtopics(id) ON DELETE SET NULL,
  verification_status text NOT NULL DEFAULT 'RAW_RECONSTRUCTION' CHECK (verification_status IN ('RAW_RECONSTRUCTION','NEEDS_REVIEW','VIDEO_RECONSTRUCTED','CROSS_SOURCE_RECONSTRUCTED','VERIFIED_SECONDARY','OFFICIAL_VERIFIED','REJECTED')),
  confidence numeric NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 1),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX question_occurrences_question_idx ON public.question_occurrences(question_id);
CREATE INDEX question_occurrences_video_idx ON public.question_occurrences(source_video_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_occurrences TO authenticated;
GRANT ALL ON public.question_occurrences TO service_role;
ALTER TABLE public.question_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "question_occurrences_admin" ON public.question_occurrences FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.question_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  occurrence_id uuid REFERENCES public.question_occurrences(id) ON DELETE SET NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('VIDEO_FRAME','VIDEO_OCR','CAPTION','SPEECH_TRANSCRIPT','PRESENTER_ANSWER','SECOND_VIDEO_MATCH','OFFICIAL_DOCUMENT')),
  video_source_id uuid REFERENCES public.video_sources(id) ON DELETE CASCADE,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  source_url text NOT NULL,
  timestamp_start numeric,
  timestamp_end numeric,
  raw_text text NOT NULL,
  normalized_text text,
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX question_evidence_question_idx ON public.question_evidence(question_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_evidence TO authenticated;
GRANT ALL ON public.question_evidence TO service_role;
ALTER TABLE public.question_evidence ENABLE ROW LEVEL SECURITY;
CREATE POLICY "question_evidence_admin" ON public.question_evidence FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Gold corpus: C+ level and per-question rows
ALTER TABLE public.gold_corpus DROP CONSTRAINT IF EXISTS gold_corpus_quality_level_check;
ALTER TABLE public.gold_corpus ADD CONSTRAINT gold_corpus_quality_level_check CHECK (quality_level IN ('A','B','C+','C','D'));
ALTER TABLE public.gold_corpus ADD COLUMN question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE;
ALTER TABLE public.gold_corpus DROP CONSTRAINT IF EXISTS gold_corpus_url_post_type_key;
CREATE UNIQUE INDEX gold_corpus_artifact_uniq ON public.gold_corpus(url, post_type) WHERE question_id IS NULL;
CREATE UNIQUE INDEX gold_corpus_question_uniq ON public.gold_corpus(question_id, post_type) WHERE question_id IS NOT NULL;