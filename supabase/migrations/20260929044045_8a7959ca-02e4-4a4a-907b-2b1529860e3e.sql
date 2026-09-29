DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['subjects','topics','subtopics'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS original_syllabus_wording text, ADD COLUMN IF NOT EXISTS source_page integer, ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT ''unverified''', t);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (verification_status IN (''unverified'',''verified'',''needs_review''))', t, t||'_verification_status_check');
  END LOOP;
END $$;
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS source_page_end integer;

CREATE OR REPLACE FUNCTION public._import_syllabus(payload jsonb, do_commit boolean)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  src jsonb := payload->'source';
  v_source uuid;
  s jsonb; t jsonb; u jsonb; ex text;
  v_subject uuid; v_topic uuid; v_sub uuid;
  s_slug text; t_slug text; u_slug text;
  si int := 0; ti int; ui int;
  r jsonb := jsonb_build_object('subjects_create',0,'subjects_update',0,'topics_create',0,'topics_update',0,
    'subtopics_create',0,'subtopics_update',0,'duplicates','[]'::jsonb,'invalid_references','[]'::jsonb);
  seen_s text[] := '{}'; seen_t text[]; seen_u text[];
  exam_ids jsonb := coalesce((SELECT jsonb_object_agg(slug, id) FROM exams), '{}'::jsonb);
BEGIN
  IF jsonb_typeof(payload->'subjects') <> 'array' THEN RAISE EXCEPTION 'Payload must contain a "subjects" array'; END IF;
  IF src IS NOT NULL AND src ? 'source_title' THEN
    SELECT id INTO v_source FROM syllabus_sources WHERE source_title = src->>'source_title'
      AND source_document_version IS NOT DISTINCT FROM src->>'source_document_version';
  END IF;
  IF do_commit AND src IS NOT NULL AND src ? 'source_title' THEN
    INSERT INTO syllabus_sources (source_title, source_url, source_document_version, source_recruitment_context,
      source_page_start, source_page_end, source_type, is_verified, notes)
    VALUES (src->>'source_title', src->>'source_url', src->>'source_document_version', src->>'source_recruitment_context',
      (src->>'source_page_start')::int, (src->>'source_page_end')::int, coalesce(src->>'source_type','official_syllabus'),
      coalesce((src->>'is_verified')::boolean,false), src->>'notes')
    ON CONFLICT (source_title, source_document_version) DO UPDATE SET
      source_url = EXCLUDED.source_url, source_recruitment_context = EXCLUDED.source_recruitment_context,
      source_page_start = EXCLUDED.source_page_start, source_page_end = EXCLUDED.source_page_end,
      source_type = EXCLUDED.source_type, is_verified = EXCLUDED.is_verified, notes = EXCLUDED.notes
    RETURNING id INTO v_source;
  END IF;

  FOR s IN SELECT * FROM jsonb_array_elements(payload->'subjects') LOOP
    si := si + 1;
    IF coalesce(trim(s->>'name'),'') = '' THEN
      r := jsonb_set(r,'{invalid_references}', (r->'invalid_references') || to_jsonb('Subject #'||si||' has no name')); CONTINUE;
    END IF;
    s_slug := coalesce(s->>'slug', trim(both '-' from regexp_replace(lower(s->>'name'),'[^a-z0-9]+','-','g')));
    IF s_slug = ANY(seen_s) THEN r := jsonb_set(r,'{duplicates}', (r->'duplicates') || to_jsonb('subject: '||s_slug)); CONTINUE; END IF;
    seen_s := seen_s || s_slug;
    SELECT id INTO v_subject FROM subjects WHERE slug = s_slug;
    r := jsonb_set(r, ARRAY[CASE WHEN v_subject IS NULL THEN 'subjects_create' ELSE 'subjects_update' END],
      to_jsonb((r->>(CASE WHEN v_subject IS NULL THEN 'subjects_create' ELSE 'subjects_update' END))::int + 1));
    IF do_commit THEN
      INSERT INTO subjects (name, slug, description, source_text, display_order, status, source_id, original_syllabus_wording, source_page, verification_status)
      VALUES (s->>'name', s_slug, s->>'description', s->>'source_text', coalesce((s->>'display_order')::int, si-1),
        coalesce(s->>'status','active'), v_source, s->>'original_syllabus_wording', (s->>'source_page')::int, coalesce(s->>'verification_status','unverified'))
      ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description, source_text=EXCLUDED.source_text,
        display_order=EXCLUDED.display_order, status=EXCLUDED.status, source_id=coalesce(EXCLUDED.source_id, subjects.source_id),
        original_syllabus_wording=EXCLUDED.original_syllabus_wording, source_page=EXCLUDED.source_page, verification_status=EXCLUDED.verification_status
      RETURNING id INTO v_subject;
    END IF;
    FOR ex IN SELECT jsonb_array_elements_text(coalesce(s->'exams','[]'::jsonb)) LOOP
      IF NOT exam_ids ? ex THEN
        r := jsonb_set(r,'{invalid_references}', (r->'invalid_references') || to_jsonb('Unknown exam "'||ex||'" on subject '||s_slug));
      ELSIF do_commit THEN
        INSERT INTO exam_syllabus_mapping (exam_id, entity_type, entity_id, is_included) VALUES ((exam_ids->>ex)::uuid, 'subject', v_subject, true)
        ON CONFLICT (exam_id, entity_type, entity_id) DO UPDATE SET is_included = true;
      END IF;
    END LOOP;

    ti := 0; seen_t := '{}';
    FOR t IN SELECT * FROM jsonb_array_elements(coalesce(s->'topics','[]'::jsonb)) LOOP
      ti := ti + 1;
      IF coalesce(trim(t->>'name'),'') = '' THEN
        r := jsonb_set(r,'{invalid_references}', (r->'invalid_references') || to_jsonb('Topic #'||ti||' in '||s_slug||' has no name')); CONTINUE;
      END IF;
      t_slug := coalesce(t->>'slug', trim(both '-' from regexp_replace(lower(t->>'name'),'[^a-z0-9]+','-','g')));
      IF t_slug = ANY(seen_t) THEN r := jsonb_set(r,'{duplicates}', (r->'duplicates') || to_jsonb('topic: '||s_slug||'/'||t_slug)); CONTINUE; END IF;
      seen_t := seen_t || t_slug;
      v_topic := NULL;
      IF v_subject IS NOT NULL THEN SELECT id INTO v_topic FROM topics WHERE subject_id = v_subject AND slug = t_slug; END IF;
      r := jsonb_set(r, ARRAY[CASE WHEN v_topic IS NULL THEN 'topics_create' ELSE 'topics_update' END],
        to_jsonb((r->>(CASE WHEN v_topic IS NULL THEN 'topics_create' ELSE 'topics_update' END))::int + 1));
      IF do_commit THEN
        INSERT INTO topics (subject_id, name, slug, description, source_text, display_order, estimated_minutes, status, source_id, original_syllabus_wording, source_page, source_page_end, verification_status)
        VALUES (v_subject, t->>'name', t_slug, t->>'description', t->>'source_text', coalesce((t->>'display_order')::int, ti-1),
          (t->>'estimated_minutes')::int, coalesce(t->>'status','active'), v_source, t->>'original_syllabus_wording', (t->>'source_page')::int, (t->>'source_page_end')::int, coalesce(t->>'verification_status','unverified'))
        ON CONFLICT (subject_id, slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
          source_text=EXCLUDED.source_text, display_order=EXCLUDED.display_order, estimated_minutes=EXCLUDED.estimated_minutes,
          status=EXCLUDED.status, source_id=coalesce(EXCLUDED.source_id, topics.source_id),
          original_syllabus_wording=EXCLUDED.original_syllabus_wording, source_page=EXCLUDED.source_page, source_page_end=EXCLUDED.source_page_end, verification_status=EXCLUDED.verification_status
        RETURNING id INTO v_topic;
      END IF;
      FOR ex IN SELECT jsonb_array_elements_text(coalesce(t->'exams','[]'::jsonb)) LOOP
        IF NOT exam_ids ? ex THEN
          r := jsonb_set(r,'{invalid_references}', (r->'invalid_references') || to_jsonb('Unknown exam "'||ex||'" on topic '||t_slug));
        ELSIF do_commit THEN
          INSERT INTO exam_syllabus_mapping (exam_id, entity_type, entity_id, is_included) VALUES ((exam_ids->>ex)::uuid, 'topic', v_topic, true)
          ON CONFLICT (exam_id, entity_type, entity_id) DO UPDATE SET is_included = true;
        END IF;
      END LOOP;

      ui := 0; seen_u := '{}';
      FOR u IN SELECT * FROM jsonb_array_elements(coalesce(t->'subtopics','[]'::jsonb)) LOOP
        ui := ui + 1;
        IF coalesce(trim(u->>'name'),'') = '' THEN
          r := jsonb_set(r,'{invalid_references}', (r->'invalid_references') || to_jsonb('Subtopic #'||ui||' in '||t_slug||' has no name')); CONTINUE;
        END IF;
        u_slug := coalesce(u->>'slug', trim(both '-' from regexp_replace(lower(u->>'name'),'[^a-z0-9]+','-','g')));
        IF u_slug = ANY(seen_u) THEN r := jsonb_set(r,'{duplicates}', (r->'duplicates') || to_jsonb('subtopic: '||t_slug||'/'||u_slug)); CONTINUE; END IF;
        seen_u := seen_u || u_slug;
        v_sub := NULL;
        IF v_topic IS NOT NULL THEN SELECT id INTO v_sub FROM subtopics WHERE topic_id = v_topic AND slug = u_slug; END IF;
        r := jsonb_set(r, ARRAY[CASE WHEN v_sub IS NULL THEN 'subtopics_create' ELSE 'subtopics_update' END],
          to_jsonb((r->>(CASE WHEN v_sub IS NULL THEN 'subtopics_create' ELSE 'subtopics_update' END))::int + 1));
        IF do_commit THEN
          INSERT INTO subtopics (topic_id, name, slug, description, source_text, display_order, estimated_minutes, status, source_id, original_syllabus_wording, source_page, verification_status)
          VALUES (v_topic, u->>'name', u_slug, u->>'description', u->>'source_text', coalesce((u->>'display_order')::int, ui-1),
            (u->>'estimated_minutes')::int, coalesce(u->>'status','active'), v_source, u->>'original_syllabus_wording', (u->>'source_page')::int, coalesce(u->>'verification_status','unverified'))
          ON CONFLICT (topic_id, slug) DO UPDATE SET name=EXCLUDED.name, description=EXCLUDED.description,
            source_text=EXCLUDED.source_text, display_order=EXCLUDED.display_order, estimated_minutes=EXCLUDED.estimated_minutes,
            status=EXCLUDED.status, source_id=coalesce(EXCLUDED.source_id, subtopics.source_id),
            original_syllabus_wording=EXCLUDED.original_syllabus_wording, source_page=EXCLUDED.source_page, verification_status=EXCLUDED.verification_status
          RETURNING id INTO v_sub;
        END IF;
        FOR ex IN SELECT jsonb_array_elements_text(coalesce(u->'exams','[]'::jsonb)) LOOP
          IF NOT exam_ids ? ex THEN
            r := jsonb_set(r,'{invalid_references}', (r->'invalid_references') || to_jsonb('Unknown exam "'||ex||'" on subtopic '||u_slug));
          ELSIF do_commit THEN
            INSERT INTO exam_syllabus_mapping (exam_id, entity_type, entity_id, is_included) VALUES ((exam_ids->>ex)::uuid, 'subtopic', v_sub, true)
            ON CONFLICT (exam_id, entity_type, entity_id) DO UPDATE SET is_included = true;
          END IF;
        END LOOP;
      END LOOP;
    END LOOP;
  END LOOP;
  RETURN r || jsonb_build_object('committed', do_commit);
END; $function$;

CREATE OR REPLACE FUNCTION public.syllabus_validation()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE res jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
  SELECT jsonb_build_object(
    'total_subjects', (SELECT count(*) FROM subjects),
    'total_topics', (SELECT count(*) FROM topics),
    'total_subtopics', (SELECT count(*) FROM subtopics),
    'unmapped_records',
      (SELECT count(*) FROM subjects s WHERE NOT EXISTS (SELECT 1 FROM exam_syllabus_mapping m WHERE m.entity_type='subject' AND m.entity_id=s.id AND m.is_included))
    + (SELECT count(*) FROM topics t WHERE NOT EXISTS (SELECT 1 FROM exam_syllabus_mapping m WHERE m.entity_type='topic' AND m.entity_id=t.id AND m.is_included))
    + (SELECT count(*) FROM subtopics u WHERE NOT EXISTS (SELECT 1 FROM exam_syllabus_mapping m WHERE m.entity_type='subtopic' AND m.entity_id=u.id AND m.is_included)),
    'orphan_records',
      (SELECT count(*) FROM exam_syllabus_mapping m WHERE
         (m.entity_type='subject' AND NOT EXISTS (SELECT 1 FROM subjects WHERE id=m.entity_id)) OR
         (m.entity_type='topic' AND NOT EXISTS (SELECT 1 FROM topics WHERE id=m.entity_id)) OR
         (m.entity_type='subtopic' AND NOT EXISTS (SELECT 1 FROM subtopics WHERE id=m.entity_id)))
    + (SELECT count(*) FROM topics WHERE parent_topic_id IS NOT NULL AND parent_topic_id NOT IN (SELECT id FROM topics)),
    'duplicate_slugs',
      (SELECT count(*) FROM (SELECT slug FROM subjects GROUP BY slug HAVING count(*)>1) a)
    + (SELECT count(*) FROM (SELECT subject_id, slug FROM topics GROUP BY 1,2 HAVING count(*)>1) b)
    + (SELECT count(*) FROM (SELECT topic_id, slug FROM subtopics GROUP BY 1,2 HAVING count(*)>1) c),
    'duplicate_semantic_nodes',
      (SELECT count(*) FROM (SELECT subject_id, lower(name) FROM topics GROUP BY 1,2 HAVING count(*)>1) a)
    + (SELECT count(*) FROM (SELECT topic_id, lower(name) FROM subtopics GROUP BY 1,2 HAVING count(*)>1) b),
    'missing_parent_references',
      (SELECT count(*) FROM exam_syllabus_mapping m JOIN subtopics u ON m.entity_type='subtopic' AND u.id=m.entity_id AND m.is_included
        WHERE NOT EXISTS (SELECT 1 FROM exam_syllabus_mapping p WHERE p.exam_id=m.exam_id AND p.entity_type='topic' AND p.entity_id=u.topic_id AND p.is_included))
    + (SELECT count(*) FROM exam_syllabus_mapping m JOIN topics t ON m.entity_type='topic' AND t.id=m.entity_id AND m.is_included
        WHERE NOT EXISTS (SELECT 1 FROM exam_syllabus_mapping p WHERE p.exam_id=m.exam_id AND p.entity_type='subject' AND p.entity_id=t.subject_id AND p.is_included)),
    'missing_source',
      (SELECT count(*) FROM subjects WHERE source_id IS NULL) + (SELECT count(*) FROM topics WHERE source_id IS NULL) + (SELECT count(*) FROM subtopics WHERE source_id IS NULL),
    'missing_source_page',
      (SELECT count(*) FROM subjects WHERE source_page IS NULL) + (SELECT count(*) FROM topics WHERE source_page IS NULL) + (SELECT count(*) FROM subtopics WHERE source_page IS NULL),
    'missing_original_wording',
      (SELECT count(*) FROM subjects WHERE coalesce(original_syllabus_wording,'')='') + (SELECT count(*) FROM topics WHERE coalesce(original_syllabus_wording,'')='') + (SELECT count(*) FROM subtopics WHERE coalesce(original_syllabus_wording,'')=''),
    'needs_review',
      (SELECT count(*) FROM subjects WHERE verification_status<>'verified') + (SELECT count(*) FROM topics WHERE verification_status<>'verified') + (SELECT count(*) FROM subtopics WHERE verification_status<>'verified')
  ) INTO res;
  RETURN res;
END; $function$;