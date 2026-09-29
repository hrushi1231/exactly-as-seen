-- ===== helpers =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ===== roles =====
CREATE TYPE public.app_role AS ENUM ('admin', 'learner');
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- ===== exams =====
CREATE TABLE public.exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  organization TEXT,
  post_name TEXT,
  subject_name TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX exams_single_primary ON public.exams (is_primary) WHERE is_primary;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exams TO authenticated;
GRANT ALL ON public.exams TO service_role;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exams_read" ON public.exams FOR SELECT TO authenticated USING (true);
CREATE POLICY "exams_admin_write" ON public.exams FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER exams_updated_at BEFORE UPDATE ON public.exams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.exam_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  label TEXT,
  total_questions INTEGER,
  total_marks INTEGER,
  duration_minutes INTEGER,
  negative_marking NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_patterns TO authenticated;
GRANT ALL ON public.exam_patterns TO service_role;
ALTER TABLE public.exam_patterns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "exam_patterns_read" ON public.exam_patterns FOR SELECT TO authenticated USING (true);
CREATE POLICY "exam_patterns_admin_write" ON public.exam_patterns FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER exam_patterns_updated_at BEFORE UPDATE ON public.exam_patterns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== syllabus =====
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects_read" ON public.subjects FOR SELECT TO authenticated USING (true);
CREATE POLICY "subjects_admin_write" ON public.subjects FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER subjects_updated_at BEFORE UPDATE ON public.subjects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  parent_topic_id UUID REFERENCES public.topics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topics TO authenticated;
GRANT ALL ON public.topics TO service_role;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topics_read" ON public.topics FOR SELECT TO authenticated USING (true);
CREATE POLICY "topics_admin_write" ON public.topics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER topics_updated_at BEFORE UPDATE ON public.topics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.subtopics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  estimated_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (topic_id, slug)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subtopics TO authenticated;
GRANT ALL ON public.subtopics TO service_role;
ALTER TABLE public.subtopics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subtopics_read" ON public.subtopics FOR SELECT TO authenticated USING (true);
CREATE POLICY "subtopics_admin_write" ON public.subtopics FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER subtopics_updated_at BEFORE UPDATE ON public.subtopics FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== exam syllabus mapping =====
CREATE TYPE public.syllabus_entity AS ENUM ('subject', 'topic', 'subtopic');
CREATE TABLE public.exam_syllabus_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  entity_type public.syllabus_entity NOT NULL,
  entity_id UUID NOT NULL,
  is_included BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (exam_id, entity_type, entity_id)
);
CREATE INDEX exam_syllabus_mapping_entity_idx ON public.exam_syllabus_mapping (entity_type, entity_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.exam_syllabus_mapping TO authenticated;
GRANT ALL ON public.exam_syllabus_mapping TO service_role;
ALTER TABLE public.exam_syllabus_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "esm_read" ON public.exam_syllabus_mapping FOR SELECT TO authenticated USING (true);
CREATE POLICY "esm_admin_write" ON public.exam_syllabus_mapping FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER esm_updated_at BEFORE UPDATE ON public.exam_syllabus_mapping FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== progress =====
CREATE TABLE public.user_topic_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  entity_type public.syllabus_entity NOT NULL,
  entity_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, entity_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_topic_progress TO authenticated;
GRANT ALL ON public.user_topic_progress TO service_role;
ALTER TABLE public.user_topic_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_own" ON public.user_topic_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER progress_updated_at BEFORE UPDATE ON public.user_topic_progress FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== seed exams =====
INSERT INTO public.exams (name, slug, organization, post_name, subject_name, is_primary, status, display_order) VALUES
 ('OAVS PGT Computer Science', 'oavs-pgt-cs', 'Odisha Adarsha Vidyalaya Sangathan', 'PGT', 'Computer Science', true, 'active', 1),
 ('KVS PGT Computer Science', 'kvs-pgt-cs', 'Kendriya Vidyalaya Sangathan', 'PGT', 'Computer Science', false, 'active', 2),
 ('NVS PGT Computer Science', 'nvs-pgt-cs', 'Navodaya Vidyalaya Samiti', 'PGT', 'Computer Science', false, 'active', 3),
 ('SSB Odisha PGT Computer Science', 'ssb-odisha-pgt-cs', 'State Selection Board, Odisha', 'PGT', 'Computer Science', false, 'active', 4),
 ('EMRS PGT Computer Science', 'emrs-pgt-cs', 'Eklavya Model Residential Schools (NESTS)', 'PGT', 'Computer Science', false, 'active', 5);