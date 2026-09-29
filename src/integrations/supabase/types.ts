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
