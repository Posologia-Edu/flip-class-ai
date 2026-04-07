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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          id: string
          is_published: boolean
          material_id: string | null
          peer_review_criteria: Json
          peer_review_enabled: boolean
          quiz_data: Json
          room_id: string
          title: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_published?: boolean
          material_id?: string | null
          peer_review_criteria?: Json
          peer_review_enabled?: boolean
          quiz_data?: Json
          room_id: string
          title?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_published?: boolean
          material_id?: string | null
          peer_review_criteria?: Json
          peer_review_enabled?: boolean
          quiz_data?: Json
          room_id?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_invites: {
        Row: {
          activated_at: string | null
          created_at: string
          email: string
          granted_plan: string | null
          id: string
          invited_by: string
          status: string
        }
        Insert: {
          activated_at?: string | null
          created_at?: string
          email: string
          granted_plan?: string | null
          id?: string
          invited_by: string
          status?: string
        }
        Update: {
          activated_at?: string | null
          created_at?: string
          email?: string
          granted_plan?: string | null
          id?: string
          invited_by?: string
          status?: string
        }
        Relationships: []
      }
      ai_api_keys: {
        Row: {
          api_key: string
          created_at: string
          id: string
          provider: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          provider: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          created_at: string
          estimated_cost_usd: number | null
          id: string
          model: string | null
          prompt_type: string | null
          provider: string
          tokens_input: number | null
          tokens_output: number | null
          usage_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          model?: string | null
          prompt_type?: string | null
          provider?: string
          tokens_input?: number | null
          tokens_output?: number | null
          usage_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          estimated_cost_usd?: number | null
          id?: string
          model?: string | null
          prompt_type?: string | null
          provider?: string
          tokens_input?: number | null
          tokens_output?: number | null
          usage_type?: string
          user_id?: string
        }
        Relationships: []
      }
      collaborative_projects: {
        Row: {
          created_at: string
          description: string
          id: string
          milestones: Json
          resources: Json
          roles: Json
          room_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          milestones?: Json
          resources?: Json
          roles?: Json
          room_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          milestones?: Json
          resources?: Json
          roles?: Json
          room_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborative_projects_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      disciplines: {
        Row: {
          color: string
          created_at: string
          id: string
          teacher_id: string
          title: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          teacher_id: string
          title: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          teacher_id?: string
          title?: string
        }
        Relationships: []
      }
      discussion_posts: {
        Row: {
          author_email: string | null
          author_name: string
          author_user_id: string | null
          content: string
          created_at: string
          id: string
          is_teacher: boolean
          parent_id: string | null
          room_id: string
        }
        Insert: {
          author_email?: string | null
          author_name: string
          author_user_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_teacher?: boolean
          parent_id?: string | null
          room_id: string
        }
        Update: {
          author_email?: string | null
          author_name?: string
          author_user_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_teacher?: boolean
          parent_id?: string | null
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discussion_posts_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "discussion_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discussion_posts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      institution_settings: {
        Row: {
          created_at: string
          id: string
          institution_name: string | null
          logo_url: string | null
          primary_color: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          institution_name?: string | null
          logo_url?: string | null
          primary_color?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          institution_name?: string | null
          logo_url?: string | null
          primary_color?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      materials: {
        Row: {
          content_text_for_ai: string | null
          created_at: string
          id: string
          is_published: boolean
          room_id: string
          thumbnail_url: string | null
          title: string
          type: string
          url: string | null
        }
        Insert: {
          content_text_for_ai?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          room_id: string
          thumbnail_url?: string | null
          title?: string
          type: string
          url?: string | null
        }
        Update: {
          content_text_for_ai?: string | null
          created_at?: string
          id?: string
          is_published?: boolean
          room_id?: string
          thumbnail_url?: string | null
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          room_id: string
          session_id: string | null
          teacher_id: string | null
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          room_id: string
          session_id?: string | null
          teacher_id?: string | null
          title: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          room_id?: string
          session_id?: string | null
          teacher_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "student_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          path: string
          referrer: string | null
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          path: string
          referrer?: string | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          path?: string
          referrer?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      peer_review_assignments: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          reviewee_session_id: string
          reviewer_session_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          reviewee_session_id: string
          reviewer_session_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          reviewee_session_id?: string
          reviewer_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_review_assignments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_review_assignments_reviewee_session_id_fkey"
            columns: ["reviewee_session_id"]
            isOneToOne: false
            referencedRelation: "student_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_review_assignments_reviewer_session_id_fkey"
            columns: ["reviewer_session_id"]
            isOneToOne: false
            referencedRelation: "student_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_reviews: {
        Row: {
          assignment_id: string
          comment: string | null
          created_at: string
          criteria_scores: Json
          id: string
          updated_at: string
        }
        Insert: {
          assignment_id: string
          comment?: string | null
          created_at?: string
          criteria_scores?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          comment?: string | null
          created_at?: string
          criteria_scores?: Json
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_reviews_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "peer_review_assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      project_groups: {
        Row: {
          created_at: string
          group_name: string
          id: string
          project_id: string
        }
        Insert: {
          created_at?: string
          group_name: string
          id?: string
          project_id: string
        }
        Update: {
          created_at?: string
          group_name?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_groups_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "collaborative_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_members: {
        Row: {
          assigned_role: string
          created_at: string
          group_id: string
          id: string
          session_id: string
        }
        Insert: {
          assigned_role?: string
          created_at?: string
          group_id: string
          id?: string
          session_id: string
        }
        Update: {
          assigned_role?: string
          created_at?: string
          group_id?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "student_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      project_progress: {
        Row: {
          created_at: string
          group_id: string
          id: string
          milestone_index: number
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          milestone_index: number
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          milestone_index?: number
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_progress_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "project_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank: {
        Row: {
          created_at: string
          description: string | null
          id: string
          quiz_data: Json
          tags: string[] | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          quiz_data?: Json
          tags?: string[] | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          quiz_data?: Json
          tags?: string[] | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      room_collaborators: {
        Row: {
          created_at: string
          id: string
          room_id: string
          teacher_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          room_id: string
          teacher_id: string
        }
        Update: {
          created_at?: string
          id?: string
          room_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_collaborators_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          student_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "room_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "room_students"
            referencedColumns: ["id"]
          },
        ]
      }
      room_groups: {
        Row: {
          created_at: string
          group_name: string
          id: string
          room_id: string
        }
        Insert: {
          created_at?: string
          group_name: string
          id?: string
          room_id: string
        }
        Update: {
          created_at?: string
          group_name?: string
          id?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_groups_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      room_students: {
        Row: {
          created_at: string
          id: string
          room_id: string
          student_email: string
          student_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          room_id: string
          student_email: string
          student_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          room_id?: string
          student_email?: string
          student_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_students_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          discipline_id: string | null
          expire_at: string | null
          id: string
          last_student_activity_at: string | null
          pin_code: string
          teacher_id: string
          title: string
          unlock_at: string | null
        }
        Insert: {
          created_at?: string
          discipline_id?: string | null
          expire_at?: string | null
          id?: string
          last_student_activity_at?: string | null
          pin_code: string
          teacher_id: string
          title: string
          unlock_at?: string | null
        }
        Update: {
          created_at?: string
          discipline_id?: string | null
          expire_at?: string | null
          id?: string
          last_student_activity_at?: string | null
          pin_code?: string
          teacher_id?: string
          title?: string
          unlock_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_discipline_id_fkey"
            columns: ["discipline_id"]
            isOneToOne: false
            referencedRelation: "disciplines"
            referencedColumns: ["id"]
          },
        ]
      }
      student_activity_logs: {
        Row: {
          activity_type: string
          created_at: string
          duration_seconds: number | null
          id: string
          material_id: string | null
          metadata: Json | null
          room_id: string
          session_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          material_id?: string | null
          metadata?: Json | null
          room_id: string
          session_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string
          duration_seconds?: number | null
          id?: string
          material_id?: string | null
          metadata?: Json | null
          room_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_activity_logs_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_activity_logs_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_activity_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "student_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_sessions: {
        Row: {
          answers: Json | null
          completed_at: string | null
          created_at: string
          feedback_email_sent_at: string | null
          id: string
          room_id: string
          score: number | null
          student_email: string | null
          student_name: string
        }
        Insert: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string
          feedback_email_sent_at?: string | null
          id?: string
          room_id: string
          score?: number | null
          student_email?: string | null
          student_name: string
        }
        Update: {
          answers?: Json | null
          completed_at?: string | null
          created_at?: string
          feedback_email_sent_at?: string | null
          id?: string
          room_id?: string
          score?: number | null
          student_email?: string | null
          student_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_updates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          implemented_at: string | null
          priority: string | null
          status: string
          title: string
          type: string
          version: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          implemented_at?: string | null
          priority?: string | null
          status?: string
          title: string
          type?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          implemented_at?: string | null
          priority?: string | null
          status?: string
          title?: string
          type?: string
          version?: string | null
        }
        Relationships: []
      }
      teacher_feedback: {
        Row: {
          created_at: string
          feedback_text: string | null
          grade: number | null
          id: string
          question_key: string
          session_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          feedback_text?: string | null
          grade?: number | null
          id?: string
          question_key: string
          session_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          feedback_text?: string | null
          grade?: number | null
          id?: string
          question_key?: string
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "student_sessions"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_room_collaborator: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      is_room_owner: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "teacher"
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
      app_role: ["admin", "teacher"],
    },
  },
} as const
