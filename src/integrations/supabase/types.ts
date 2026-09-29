export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      candidate_links: {
        Row: {
          anchor_text: string | null
          confidence: number
          created_at: string
          detected_file_type: string | null
          document_id: string | null
          exam_id: string | null
          id: string
          parent_page_url: string | null
          possible_document_type: string | null
          possible_year: number | null
          run_id: string | null
          source_domain_id: string | null
          status: string
          updated_at: string
          url: string
        }
        Insert: {
          anchor_text?: string | null
          confidence?: number
          created_at?: string
          detected_file_type?: string | null
          document_id?: string | null
          exam_id?: string | null
          id?: string
          parent_page_url?: string | null
          possible_document_type?: string | null
          possible_year?: number | null
          run_id?: string | null
          source_domain_id?: string | null
          status?: string
          updated_at?: string
          url: string
        }
        Update: {
          anchor_text?: string | null
          confidence?: number
          created_at?: string
          detected_file_type?: string | null
          document_id?: string | null
          exam_id?: string | null
          id?: string
          parent_page_url?: string | null
          possible_document_type?: string | null
          possible_year?: number | null
          run_id?: string | null
          source_domain_id?: string | null
          status?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_links_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_links_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "collection_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_links_source_domain_id_fkey"
            columns: ["source_domain_id"]
            isOneToOne: false
            referencedRelation: "source_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_events: {
        Row: {
          created_at: string
          document_id: string | null
          id: string
          level: string
          message: string
          run_id: string
          url: string | null
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          id?: string
          level?: string
          message: string
          run_id: string
          url?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string | null
          id?: string
          level?: string
          message?: string
          run_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_events_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "collection_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_runs: {
        Row: {
          created_at: string
          document_id: string | null
          documents_created: number
          documents_updated: number
          duplicates_detected: number
          errors: number
          files_downloaded: number
          finished_at: string | null
          id: string
          links_discovered: number
          source_domain_id: string | null
          started_at: string
          status: string
          strategy: string
          target_url: string | null
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          document_id?: string | null
          documents_created?: number
          documents_updated?: number
          duplicates_detected?: number
          errors?: number
          files_downloaded?: number
          finished_at?: string | null
          id?: string
          links_discovered?: number
          source_domain_id?: string | null
          started_at?: string
          status?: string
          strategy: string
          target_url?: string | null
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          document_id?: string | null
          documents_created?: number
          documents_updated?: number
          duplicates_detected?: number
          errors?: number
          files_downloaded?: number
          finished_at?: string | null
          id?: string
          links_discovered?: number
          source_domain_id?: string | null
          started_at?: string
          status?: string
          strategy?: string
          target_url?: string | null
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "collection_runs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_runs_source_domain_id_fkey"
            columns: ["source_domain_id"]
            isOneToOne: false
            referencedRelation: "source_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_candidates: {
        Row: {
          advertisement_numbers: string[]
          artifact_type_guess: string
          authority: string
          authority_guess: string
          canonical_url: string
          captions_available: boolean | null
          confidence: number
          cycle_ids: string[]
          depth: number
          discovered_at: string
          discovery_queries: string[]
          document_id: string | null
          exam_dates: string[]
          exam_id: string | null
          file_checks: Json | null
          id: string
          is_downloadable: boolean
          page_title: string | null
          parent_candidate_id: string | null
          post_matches: string[]
          post_type_guess: string
          provider: string
          publication_date: string | null
          resolution_reason: string | null
          resolution_score: number | null
          resolution_status: string
          resolved_artifact_type: string | null
          resolved_at: string | null
          snippet: string | null
          source_domain: string
          source_kind: string
          status: string
          title: string | null
          updated_at: string
          url: string
          video_channel: string | null
          video_class: string | null
          video_description: string | null
          video_duration_seconds: number | null
          video_id: string | null
          video_published_at: string | null
          year_confidence: string | null
          year_evidence: string | null
          year_guess: number | null
          year_value: number | null
        }
        Insert: {
          advertisement_numbers?: string[]
          artifact_type_guess?: string
          authority?: string
          authority_guess?: string
          canonical_url: string
          captions_available?: boolean | null
          confidence?: number
          cycle_ids?: string[]
          depth?: number
          discovered_at?: string
          discovery_queries?: string[]
          document_id?: string | null
          exam_dates?: string[]
          exam_id?: string | null
          file_checks?: Json | null
          id?: string
          is_downloadable?: boolean
          page_title?: string | null
          parent_candidate_id?: string | null
          post_matches?: string[]
          post_type_guess?: string
          provider: string
          publication_date?: string | null
          resolution_reason?: string | null
          resolution_score?: number | null
          resolution_status?: string
          resolved_artifact_type?: string | null
          resolved_at?: string | null
          snippet?: string | null
          source_domain: string
          source_kind?: string
          status?: string
          title?: string | null
          updated_at?: string
          url: string
          video_channel?: string | null
          video_class?: string | null
          video_description?: string | null
          video_duration_seconds?: number | null
          video_id?: string | null
          video_published_at?: string | null
          year_confidence?: string | null
          year_evidence?: string | null
          year_guess?: number | null
          year_value?: number | null
        }
        Update: {
          advertisement_numbers?: string[]
          artifact_type_guess?: string
          authority?: string
          authority_guess?: string
          canonical_url?: string
          captions_available?: boolean | null
          confidence?: number
          cycle_ids?: string[]
          depth?: number
          discovered_at?: string
          discovery_queries?: string[]
          document_id?: string | null
          exam_dates?: string[]
          exam_id?: string | null
          file_checks?: Json | null
          id?: string
          is_downloadable?: boolean
          page_title?: string | null
          parent_candidate_id?: string | null
          post_matches?: string[]
          post_type_guess?: string
          provider?: string
          publication_date?: string | null
          resolution_reason?: string | null
          resolution_score?: number | null
          resolution_status?: string
          resolved_artifact_type?: string | null
          resolved_at?: string | null
          snippet?: string | null
          source_domain?: string
          source_kind?: string
          status?: string
          title?: string | null
          updated_at?: string
          url?: string
          video_channel?: string | null
          video_class?: string | null
          video_description?: string | null
          video_duration_seconds?: number | null
          video_id?: string | null
          video_published_at?: string | null
          year_confidence?: string | null
          year_evidence?: string | null
          year_guess?: number | null
          year_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "discovery_candidates_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_candidates_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discovery_candidates_parent_candidate_id_fkey"
            columns: ["parent_candidate_id"]
            isOneToOne: false
            referencedRelation: "discovery_candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      discovery_queries: {
        Row: {
          cycle_id: string
          error: string | null
          id: string
          provider: string
          query: string
          query_kind: string
          ran_at: string
          result_count: number
        }
        Insert: {
          cycle_id: string
          error?: string | null
          id?: string
          provider: string
          query: string
          query_kind: string
          ran_at?: string
          result_count?: number
        }
        Update: {
          cycle_id?: string
          error?: string | null
          id?: string
          provider?: string
          query?: string
          query_kind?: string
          ran_at?: string
          result_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "discovery_queries_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "pyq_research_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_files: {
        Row: {
          created_at: string
          document_id: string
          file_size: number | null
          id: string
          mime_type: string | null
          original_filename: string | null
          page_count: number | null
          sha256: string
          storage_path: string
          text_extractable: boolean | null
        }
        Insert: {
          created_at?: string
          document_id: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          page_count?: number | null
          sha256: string
          storage_path: string
          text_extractable?: boolean | null
        }
        Update: {
          created_at?: string
          document_id?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string | null
          page_count?: number | null
          sha256?: string
          storage_path?: string
          text_extractable?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "document_files_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_provenance: {
        Row: {
          created_at: string
          document_id: string
          id: string
          landing_page_url: string | null
          notes: string | null
          source_domain_id: string | null
          url: string
        }
        Insert: {
          created_at?: string
          document_id: string
          id?: string
          landing_page_url?: string | null
          notes?: string | null
          source_domain_id?: string | null
          url: string
        }
        Update: {
          created_at?: string
          document_id?: string
          id?: string
          landing_page_url?: string | null
          notes?: string | null
          source_domain_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_provenance_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_provenance_source_domain_id_fkey"
            columns: ["source_domain_id"]
            isOneToOne: false
            referencedRelation: "source_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          authority_level: string
          created_at: string
          cycle_id: string | null
          discovered_at: string
          document_type: string
          download_status: string
          downloaded_at: string | null
          duplicate_of_document_id: string | null
          exam_id: string | null
          file_size: number | null
          id: string
          landing_page_url: string | null
          mime_type: string | null
          post_name: string | null
          post_type: string | null
          publication_date: string | null
          recruitment_cycle: string | null
          sha256: string | null
          source_domain_id: string | null
          source_notes: string | null
          source_url: string
          subject: string | null
          title: string
          updated_at: string
          verification_status: string
          year: number | null
        }
        Insert: {
          authority_level?: string
          created_at?: string
          cycle_id?: string | null
          discovered_at?: string
          document_type?: string
          download_status?: string
          downloaded_at?: string | null
          duplicate_of_document_id?: string | null
          exam_id?: string | null
          file_size?: number | null
          id?: string
          landing_page_url?: string | null
          mime_type?: string | null
          post_name?: string | null
          post_type?: string | null
          publication_date?: string | null
          recruitment_cycle?: string | null
          sha256?: string | null
          source_domain_id?: string | null
          source_notes?: string | null
          source_url: string
          subject?: string | null
          title: string
          updated_at?: string
          verification_status?: string
          year?: number | null
        }
        Update: {
          authority_level?: string
          created_at?: string
          cycle_id?: string | null
          discovered_at?: string
          document_type?: string
          download_status?: string
          downloaded_at?: string | null
          duplicate_of_document_id?: string | null
          exam_id?: string | null
          file_size?: number | null
          id?: string
          landing_page_url?: string | null
          mime_type?: string | null
          post_name?: string | null
          post_type?: string | null
          publication_date?: string | null
          recruitment_cycle?: string | null
          sha256?: string | null
          source_domain_id?: string | null
          source_notes?: string | null
          source_url?: string
          subject?: string | null
          title?: string
          updated_at?: string
          verification_status?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "exam_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_duplicate_of_document_id_fkey"
            columns: ["duplicate_of_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_source_domain_id_fkey"
            columns: ["source_domain_id"]
            isOneToOne: false
            referencedRelation: "source_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_claims: {
        Row: {
          authority: string
          candidate_id: string | null
          claim: string
          claim_type: string
          created_at: string
          cycle_id: string | null
          document_id: string | null
          excerpt: string | null
          id: string
          post_type: string | null
          source_url: string
        }
        Insert: {
          authority?: string
          candidate_id?: string | null
          claim: string
          claim_type: string
          created_at?: string
          cycle_id?: string | null
          document_id?: string | null
          excerpt?: string | null
          id?: string
          post_type?: string | null
          source_url: string
        }
        Update: {
          authority?: string
          candidate_id?: string | null
          claim?: string
          claim_type?: string
          created_at?: string
          cycle_id?: string | null
          document_id?: string | null
          excerpt?: string | null
          id?: string
          post_type?: string | null
          source_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_claims_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "discovery_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_claims_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "exam_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_claims_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_cycles: {
        Row: {
          advertisement_number: string | null
          computer_teacher_evidence_url: string | null
          computer_teacher_status: string
          created_at: string
          display_order: number
          exam_date: string | null
          exam_id: string
          exam_start_date: string | null
          exam_year: number | null
          id: string
          label: string
          notes: string | null
          pgt_cs_evidence_url: string | null
          pgt_cs_status: string
          recruitment_cycle: number | null
          updated_at: string
        }
        Insert: {
          advertisement_number?: string | null
          computer_teacher_evidence_url?: string | null
          computer_teacher_status?: string
          created_at?: string
          display_order?: number
          exam_date?: string | null
          exam_id: string
          exam_start_date?: string | null
          exam_year?: number | null
          id?: string
          label: string
          notes?: string | null
          pgt_cs_evidence_url?: string | null
          pgt_cs_status?: string
          recruitment_cycle?: number | null
          updated_at?: string
        }
        Update: {
          advertisement_number?: string | null
          computer_teacher_evidence_url?: string | null
          computer_teacher_status?: string
          created_at?: string
          display_order?: number
          exam_date?: string | null
          exam_id?: string
          exam_start_date?: string | null
          exam_year?: number | null
          id?: string
          label?: string
          notes?: string | null
          pgt_cs_evidence_url?: string | null
          pgt_cs_status?: string
          recruitment_cycle?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_cycles_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_patterns: {
        Row: {
          created_at: string
          duration_minutes: number | null
          exam_id: string
          id: string
          is_current: boolean
          label: string | null
          marks_per_correct: number | null
          negative_marking: number | null
          notes: string | null
          recruitment_cycle: string | null
          sections: Json
          source_id: string | null
          total_marks: number | null
          total_questions: number | null
          updated_at: string
          version: string
        }
        Insert: {
          created_at?: string
          duration_minutes?: number | null
          exam_id: string
          id?: string
          is_current?: boolean
          label?: string | null
          marks_per_correct?: number | null
          negative_marking?: number | null
          notes?: string | null
          recruitment_cycle?: string | null
          sections?: Json
          source_id?: string | null
          total_marks?: number | null
          total_questions?: number | null
          updated_at?: string
          version?: string
        }
        Update: {
          created_at?: string
          duration_minutes?: number | null
          exam_id?: string
          id?: string
          is_current?: boolean
          label?: string | null
          marks_per_correct?: number | null
          negative_marking?: number | null
          notes?: string | null
          recruitment_cycle?: string | null
          sections?: Json
          source_id?: string | null
          total_marks?: number | null
          total_questions?: number | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_patterns_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_patterns_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "syllabus_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_syllabus_mapping: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["syllabus_entity"]
          exam_id: string
          id: string
          is_included: boolean
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["syllabus_entity"]
          exam_id: string
          id?: string
          is_included?: boolean
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["syllabus_entity"]
          exam_id?: string
          id?: string
          is_included?: boolean
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_syllabus_mapping_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_primary: boolean
          name: string
          organization: string | null
          post_name: string | null
          slug: string
          status: string
          subject_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          name: string
          organization?: string | null
          post_name?: string | null
          slug: string
          status?: string
          subject_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_primary?: boolean
          name?: string
          organization?: string | null
          post_name?: string | null
          slug?: string
          status?: string
          subject_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gold_corpus: {
        Row: {
          artifact_type: string
          candidate_id: string | null
          created_at: string
          cycle_id: string | null
          document_id: string | null
          id: string
          post_type: string
          quality_level: string
          question_id: string | null
          reason: string | null
          title: string | null
          updated_at: string
          url: string
          verified: boolean
        }
        Insert: {
          artifact_type: string
          candidate_id?: string | null
          created_at?: string
          cycle_id?: string | null
          document_id?: string | null
          id?: string
          post_type: string
          quality_level: string
          question_id?: string | null
          reason?: string | null
          title?: string | null
          updated_at?: string
          url: string
          verified?: boolean
        }
        Update: {
          artifact_type?: string
          candidate_id?: string | null
          created_at?: string
          cycle_id?: string | null
          document_id?: string | null
          id?: string
          post_type?: string
          quality_level?: string
          question_id?: string | null
          reason?: string | null
          title?: string | null
          updated_at?: string
          url?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "gold_corpus_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "discovery_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gold_corpus_cycle_id_fkey"
            columns: ["cycle_id"]
            isOneToOne: false
            referencedRelation: "exam_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gold_corpus_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gold_corpus_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      pyq_research_cycles: {
        Row: {
          answer_key_found: boolean
          candidate_count: number
          created_at: string
          evidence_status: string
          exam_id: string
          id: string
          last_searched_at: string | null
          notes: string | null
          official_candidates: number
          paper_found: boolean
          post_type: string
          queries_run: number
          response_sheet_found: boolean
          search_status: string
          secondary_candidates: number
          updated_at: string
          video_candidates: number
          year: number
        }
        Insert: {
          answer_key_found?: boolean
          candidate_count?: number
          created_at?: string
          evidence_status?: string
          exam_id: string
          id?: string
          last_searched_at?: string | null
          notes?: string | null
          official_candidates?: number
          paper_found?: boolean
          post_type: string
          queries_run?: number
          response_sheet_found?: boolean
          search_status?: string
          secondary_candidates?: number
          updated_at?: string
          video_candidates?: number
          year: number
        }
        Update: {
          answer_key_found?: boolean
          candidate_count?: number
          created_at?: string
          evidence_status?: string
          exam_id?: string
          id?: string
          last_searched_at?: string | null
          notes?: string | null
          official_candidates?: number
          paper_found?: boolean
          post_type?: string
          queries_run?: number
          response_sheet_found?: boolean
          search_status?: string
          secondary_candidates?: number
          updated_at?: string
          video_candidates?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "pyq_research_cycles_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      question_evidence: {
        Row: {
          confidence: number | null
          created_at: string
          document_id: string | null
          evidence_type: string
          id: string
          meta: Json
          normalized_text: string | null
          occurrence_id: string | null
          question_id: string
          raw_text: string
          source_url: string
          timestamp_end: number | null
          timestamp_start: number | null
          video_source_id: string | null
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          document_id?: string | null
          evidence_type: string
          id?: string
          meta?: Json
          normalized_text?: string | null
          occurrence_id?: string | null
          question_id: string
          raw_text: string
          source_url: string
          timestamp_end?: number | null
          timestamp_start?: number | null
          video_source_id?: string | null
        }
        Update: {
          confidence?: number | null
          created_at?: string
          document_id?: string | null
          evidence_type?: string
          id?: string
          meta?: Json
          normalized_text?: string | null
          occurrence_id?: string | null
          question_id?: string
          raw_text?: string
          source_url?: string
          timestamp_end?: number | null
          timestamp_start?: number | null
          video_source_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_evidence_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_evidence_occurrence_id_fkey"
            columns: ["occurrence_id"]
            isOneToOne: false
            referencedRelation: "question_occurrences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_evidence_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_evidence_video_source_id_fkey"
            columns: ["video_source_id"]
            isOneToOne: false
            referencedRelation: "video_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      question_occurrences: {
        Row: {
          confidence: number
          created_at: string
          exam_id: string
          exam_year: number | null
          id: string
          post_type: string
          question_id: string
          question_number: number | null
          resolved_cycle_id: string | null
          source_timestamp_end: number | null
          source_timestamp_start: number
          source_video_id: string
          subject_id: string | null
          subtopic_id: string | null
          topic_id: string | null
          verification_status: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          exam_id: string
          exam_year?: number | null
          id?: string
          post_type: string
          question_id: string
          question_number?: number | null
          resolved_cycle_id?: string | null
          source_timestamp_end?: number | null
          source_timestamp_start: number
          source_video_id: string
          subject_id?: string | null
          subtopic_id?: string | null
          topic_id?: string | null
          verification_status?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          exam_id?: string
          exam_year?: number | null
          id?: string
          post_type?: string
          question_id?: string
          question_number?: number | null
          resolved_cycle_id?: string | null
          source_timestamp_end?: number | null
          source_timestamp_start?: number
          source_video_id?: string
          subject_id?: string | null
          subtopic_id?: string | null
          topic_id?: string | null
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_occurrences_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_occurrences_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_occurrences_resolved_cycle_id_fkey"
            columns: ["resolved_cycle_id"]
            isOneToOne: false
            referencedRelation: "exam_cycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_occurrences_source_video_id_fkey"
            columns: ["source_video_id"]
            isOneToOne: false
            referencedRelation: "video_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_occurrences_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_occurrences_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "subtopics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_occurrences_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      question_options: {
        Row: {
          display_order: number
          id: string
          is_presented_answer: boolean
          label: string
          option_text: string
          question_id: string
          raw_text: string | null
        }
        Insert: {
          display_order?: number
          id?: string
          is_presented_answer?: boolean
          label: string
          option_text: string
          question_id: string
          raw_text?: string | null
        }
        Update: {
          display_order?: number
          id?: string
          is_presented_answer?: boolean
          label?: string
          option_text?: string
          question_id?: string
          raw_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          answer_label: string | null
          answer_status: string
          confidence: number
          created_at: string
          id: string
          language: string
          merged_into_id: string | null
          normalization_status: string
          pyq_claim: string
          quality_flags: string[]
          question_text: string
          question_type: string
          reviewed_at: string | null
          reviewed_by: string | null
          source_text: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          answer_label?: string | null
          answer_status?: string
          confidence?: number
          created_at?: string
          id?: string
          language?: string
          merged_into_id?: string | null
          normalization_status?: string
          pyq_claim?: string
          quality_flags?: string[]
          question_text: string
          question_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_text: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          answer_label?: string | null
          answer_status?: string
          confidence?: number
          created_at?: string
          id?: string
          language?: string
          merged_into_id?: string | null
          normalization_status?: string
          pyq_claim?: string
          quality_flags?: string[]
          question_text?: string
          question_type?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_text?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_merged_into_id_fkey"
            columns: ["merged_into_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      source_domains: {
        Row: {
          authority_level: string
          base_url: string
          crawl_notes: string | null
          created_at: string
          exam_id: string | null
          id: string
          is_active: boolean
          name: string
          organization: string | null
          priority: string
          robots_notes: string | null
          source_type: string
          updated_at: string
        }
        Insert: {
          authority_level?: string
          base_url: string
          crawl_notes?: string | null
          created_at?: string
          exam_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization?: string | null
          priority?: string
          robots_notes?: string | null
          source_type?: string
          updated_at?: string
        }
        Update: {
          authority_level?: string
          base_url?: string
          crawl_notes?: string | null
          created_at?: string
          exam_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization?: string | null
          priority?: string
          robots_notes?: string | null
          source_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_domains_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          original_syllabus_wording: string | null
          slug: string
          source_id: string | null
          source_page: number | null
          source_text: string | null
          status: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          original_syllabus_wording?: string | null
          slug: string
          source_id?: string | null
          source_page?: number | null
          source_text?: string | null
          status?: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          original_syllabus_wording?: string | null
          slug?: string
          source_id?: string | null
          source_page?: number | null
          source_text?: string | null
          status?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "syllabus_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      subtopics: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          estimated_minutes: number | null
          id: string
          name: string
          original_syllabus_wording: string | null
          slug: string
          source_id: string | null
          source_page: number | null
          source_text: string | null
          status: string
          topic_id: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          estimated_minutes?: number | null
          id?: string
          name: string
          original_syllabus_wording?: string | null
          slug: string
          source_id?: string | null
          source_page?: number | null
          source_text?: string | null
          status?: string
          topic_id: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          estimated_minutes?: number | null
          id?: string
          name?: string
          original_syllabus_wording?: string | null
          slug?: string
          source_id?: string | null
          source_page?: number | null
          source_text?: string | null
          status?: string
          topic_id?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subtopics_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "syllabus_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subtopics_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
        ]
      }
      syllabus_sources: {
        Row: {
          created_at: string
          id: string
          is_verified: boolean
          notes: string | null
          source_document_version: string | null
          source_page_end: number | null
          source_page_start: number | null
          source_recruitment_context: string | null
          source_title: string
          source_type: string
          source_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_verified?: boolean
          notes?: string | null
          source_document_version?: string | null
          source_page_end?: number | null
          source_page_start?: number | null
          source_recruitment_context?: string | null
          source_title: string
          source_type?: string
          source_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_verified?: boolean
          notes?: string | null
          source_document_version?: string | null
          source_page_end?: number | null
          source_page_start?: number | null
          source_recruitment_context?: string | null
          source_title?: string
          source_type?: string
          source_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      topics: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          estimated_minutes: number | null
          id: string
          name: string
          original_syllabus_wording: string | null
          parent_topic_id: string | null
          slug: string
          source_id: string | null
          source_page: number | null
          source_page_end: number | null
          source_text: string | null
          status: string
          subject_id: string
          updated_at: string
          verification_status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          estimated_minutes?: number | null
          id?: string
          name: string
          original_syllabus_wording?: string | null
          parent_topic_id?: string | null
          slug: string
          source_id?: string | null
          source_page?: number | null
          source_page_end?: number | null
          source_text?: string | null
          status?: string
          subject_id: string
          updated_at?: string
          verification_status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          estimated_minutes?: number | null
          id?: string
          name?: string
          original_syllabus_wording?: string | null
          parent_topic_id?: string | null
          slug?: string
          source_id?: string | null
          source_page?: number | null
          source_page_end?: number | null
          source_text?: string | null
          status?: string
          subject_id?: string
          updated_at?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "topics_parent_topic_id_fkey"
            columns: ["parent_topic_id"]
            isOneToOne: false
            referencedRelation: "topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "syllabus_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_topic_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["syllabus_entity"]
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["syllabus_entity"]
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["syllabus_entity"]
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_processing_runs: {
        Row: {
          candidates_found: number
          error: string | null
          finished_at: string | null
          frames_candidate: number
          frames_ocr: number
          id: string
          started_at: string
          status: string
          steps: Json
          transcript_language: string | null
          transcript_source: string | null
          video_source_id: string
          worker_version: string
        }
        Insert: {
          candidates_found?: number
          error?: string | null
          finished_at?: string | null
          frames_candidate?: number
          frames_ocr?: number
          id?: string
          started_at?: string
          status?: string
          steps?: Json
          transcript_language?: string | null
          transcript_source?: string | null
          video_source_id: string
          worker_version: string
        }
        Update: {
          candidates_found?: number
          error?: string | null
          finished_at?: string | null
          frames_candidate?: number
          frames_ocr?: number
          id?: string
          started_at?: string
          status?: string
          steps?: Json
          transcript_language?: string | null
          transcript_source?: string | null
          video_source_id?: string
          worker_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_processing_runs_video_source_id_fkey"
            columns: ["video_source_id"]
            isOneToOne: false
            referencedRelation: "video_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      video_sources: {
        Row: {
          auto_caption_languages: string[]
          candidate_id: string | null
          canonical_url: string
          caption_languages: string[]
          captions_available: boolean | null
          channel: string | null
          channel_id: string | null
          claimed_exam_year: number | null
          claimed_exam_year_evidence: string | null
          created_at: string
          description: string | null
          duration_seconds: number | null
          exam_year_confidence: string
          exam_year_evidence: string | null
          id: string
          metadata_error: string | null
          metadata_status: string
          post_type: string
          processing_status: string
          pyq_claim: string
          pyq_claim_evidence: string | null
          resolved_cycle_id: string | null
          thumbnail_url: string | null
          title: string | null
          updated_at: string
          video_id: string
          video_publish_date: string | null
        }
        Insert: {
          auto_caption_languages?: string[]
          candidate_id?: string | null
          canonical_url: string
          caption_languages?: string[]
          captions_available?: boolean | null
          channel?: string | null
          channel_id?: string | null
          claimed_exam_year?: number | null
          claimed_exam_year_evidence?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          exam_year_confidence?: string
          exam_year_evidence?: string | null
          id?: string
          metadata_error?: string | null
          metadata_status?: string
          post_type: string
          processing_status?: string
          pyq_claim?: string
          pyq_claim_evidence?: string | null
          resolved_cycle_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_id: string
          video_publish_date?: string | null
        }
        Update: {
          auto_caption_languages?: string[]
          candidate_id?: string | null
          canonical_url?: string
          caption_languages?: string[]
          captions_available?: boolean | null
          channel?: string | null
          channel_id?: string | null
          claimed_exam_year?: number | null
          claimed_exam_year_evidence?: string | null
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          exam_year_confidence?: string
          exam_year_evidence?: string | null
          id?: string
          metadata_error?: string | null
          metadata_status?: string
          post_type?: string
          processing_status?: string
          pyq_claim?: string
          pyq_claim_evidence?: string | null
          resolved_cycle_id?: string | null
          thumbnail_url?: string | null
          title?: string | null
          updated_at?: string
          video_id?: string
          video_publish_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "video_sources_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "discovery_candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "video_sources_resolved_cycle_id_fkey"
            columns: ["resolved_cycle_id"]
            isOneToOne: false
            referencedRelation: "exam_cycles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _import_syllabus: {
        Args: { do_commit: boolean; payload: Json }
        Returns: Json
      }
      admin_exists: { Args: never; Returns: boolean }
      claim_first_admin: { Args: never; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_syllabus: {
        Args: { do_commit?: boolean; payload: Json }
        Returns: Json
      }
      syllabus_validation: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "learner"
      syllabus_entity: "subject" | "topic" | "subtopic"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "learner"],
      syllabus_entity: ["subject", "topic", "subtopic"],
    },
  },
} as const
