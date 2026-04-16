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
      companies: {
        Row: {
          created_at: string
          id: string
          job_listing_index: string | null
          last_checked_at: string | null
          name: string
          site: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          job_listing_index?: string | null
          last_checked_at?: string | null
          name: string
          site?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          job_listing_index?: string | null
          last_checked_at?: string | null
          name?: string
          site?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          company_id: string | null
          created_at: string
          date_applied: string | null
          deleted_at: string | null
          description: string | null
          description_full: string | null
          id: string
          resume_id: string | null
          session_id: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string | null
          updated_at: string
          url: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          date_applied?: string | null
          deleted_at?: string | null
          description?: string | null
          description_full?: string | null
          id?: string
          resume_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string | null
          updated_at?: string
          url: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          date_applied?: string | null
          deleted_at?: string | null
          description?: string | null
          description_full?: string | null
          id?: string
          resume_id?: string | null
          session_id?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string | null
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_resume_id_fkey"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: string
          created_at: string
          id: string
          job_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          job_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          job_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          context: string | null
          created_at: string
          id: string
          job_id: string
          question: string
          response: string | null
          updated_at: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          job_id: string
          question: string
          response?: string | null
          updated_at?: string
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          job_id?: string
          question?: string
          response?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      resumes: {
        Row: {
          content: string
          created_at: string
          filename: string
          id: string
          pdf_path: string | null
        }
        Insert: {
          content: string
          created_at?: string
          filename: string
          id?: string
          pdf_path?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          filename?: string
          id?: string
          pdf_path?: string | null
        }
        Relationships: []
      }
      status_logs: {
        Row: {
          created_at: string
          id: string
          job_id: string
          note: string | null
          status: Database["public"]["Enums"]["job_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          job_id: string
          note?: string | null
          status: Database["public"]["Enums"]["job_status"]
        }
        Update: {
          created_at?: string
          id?: string
          job_id?: string
          note?: string | null
          status?: Database["public"]["Enums"]["job_status"]
        }
        Relationships: [
          {
            foreignKeyName: "status_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      job_status:
        | "RESEARCHING"
        | "PENDING_APPLICATION"
        | "APPLIED"
        | "INTERVIEWING"
        | "OFFERED"
        | "DENIED"
        | "WITHDRAWN"
        | "RESEARCH_ERROR"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      job_status: [
        "RESEARCHING",
        "PENDING_APPLICATION",
        "APPLIED",
        "INTERVIEWING",
        "OFFERED",
        "DENIED",
        "WITHDRAWN",
        "RESEARCH_ERROR",
      ],
    },
  },
} as const
