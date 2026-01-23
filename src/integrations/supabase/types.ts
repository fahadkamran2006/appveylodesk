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
      agencies: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          logo_url: string | null
          name: string
          storage_limit_bytes: number
          storage_used_bytes: number
          subscription_plan: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name: string
          storage_limit_bytes?: number
          storage_used_bytes?: number
          subscription_plan?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          storage_limit_bytes?: number
          storage_used_bytes?: number
          subscription_plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      agency_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          agency_id: string
          created_at: string
          email: string
          full_name: string | null
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          agency_id: string
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          invited_by: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          agency_id?: string
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "agency_invitations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      cancellation_requests: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          project_id: string
          reason: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          project_id: string
          reason: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          project_id?: string
          reason?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cancellation_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_mutes: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          muted_by: string
          muted_user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          muted_by: string
          muted_user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          muted_by?: string
          muted_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_mutes_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_participants: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_participants_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_read_receipts: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          last_seen_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          last_seen_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          last_seen_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_read_receipts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          is_archived: boolean
          name: string | null
          project_id: string | null
          type: Database["public"]["Enums"]["channel_type"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string | null
          project_id?: string | null
          type: Database["public"]["Enums"]["channel_type"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string | null
          project_id?: string | null
          type?: Database["public"]["Enums"]["channel_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      cleared_chats: {
        Row: {
          channel_id: string
          cleared_at: string
          id: string
          user_id: string
        }
        Insert: {
          channel_id: string
          cleared_at?: string
          id?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          cleared_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleared_chats_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverable_comments: {
        Row: {
          content: string
          created_at: string
          deliverable_id: string
          id: string
          is_resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          timestamp_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deliverable_id: string
          id?: string
          is_resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          timestamp_seconds: number
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deliverable_id?: string
          id?: string
          is_resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          timestamp_seconds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliverable_comments_deliverable_id_fkey"
            columns: ["deliverable_id"]
            isOneToOne: false
            referencedRelation: "deliverables"
            referencedColumns: ["id"]
          },
        ]
      }
      deliverables: {
        Row: {
          created_at: string
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          project_id: string
          uploaded_by: string
          version: number | null
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size?: number | null
          file_type?: string
          file_url: string
          id?: string
          project_id: string
          uploaded_by: string
          version?: number | null
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          project_id?: string
          uploaded_by?: string
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          agency_id: string
          amount: number
          client_id: string
          created_at: string
          due_date: string | null
          id: string
          paid_at: string | null
          payment_proof_url: string | null
          pdf_url: string | null
          project_id: string
          status: Database["public"]["Enums"]["invoice_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          amount: number
          client_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          payment_proof_url?: string | null
          pdf_url?: string | null
          project_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          amount?: number
          client_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          paid_at?: string | null
          payment_proof_url?: string | null
          pdf_url?: string | null
          project_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      message_read_receipts: {
        Row: {
          id: string
          message_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_read_receipts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_type: string | null
          attachment_url: string | null
          channel_id: string | null
          content: string
          created_at: string
          id: string
          is_internal: boolean | null
          project_id: string | null
          sender_id: string
        }
        Insert: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id?: string | null
          content: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          project_id?: string | null
          sender_id: string
        }
        Update: {
          attachment_type?: string | null
          attachment_url?: string | null
          channel_id?: string | null
          content?: string
          created_at?: string
          id?: string
          is_internal?: boolean | null
          project_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_id: string | null
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          onboarding_completed: boolean | null
          updated_at: string
        }
        Insert: {
          agency_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          onboarding_completed?: boolean | null
          updated_at?: string
        }
        Update: {
          agency_id?: string | null
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      project_editors: {
        Row: {
          assigned_at: string
          editor_id: string
          id: string
          project_id: string
        }
        Insert: {
          assigned_at?: string
          editor_id: string
          id?: string
          project_id: string
        }
        Update: {
          assigned_at?: string
          editor_id?: string
          id?: string
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_editors_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          agency_id: string
          budget: number | null
          client_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          editor_rate: number | null
          id: string
          reference_links: string | null
          status: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          budget?: number | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          editor_rate?: number | null
          id?: string
          reference_links?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          budget?: number | null
          client_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          editor_rate?: number | null
          id?: string
          reference_links?: string | null
          status?: Database["public"]["Enums"]["project_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_agency_invitation: {
        Args: { _token: string }
        Returns: {
          out_agency_id: string
          out_role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      add_project_channel_participant: {
        Args: { _project_id: string; _user_id: string }
        Returns: undefined
      }
      channel_belongs_to_agency: {
        Args: { _agency_id: string; _channel_id: string }
        Returns: boolean
      }
      check_storage_limit: {
        Args: { _agency_id: string; _file_size: number }
        Returns: boolean
      }
      create_project_channel: {
        Args: {
          _admin_id: string
          _agency_id: string
          _client_id?: string
          _editor_id?: string
          _project_id: string
        }
        Returns: string
      }
      get_admin_performance_metrics: {
        Args: { _agency_id: string }
        Returns: {
          avg_response_time_display: string
          avg_response_time_seconds: number
          reply_rate_percent: number
          responded_messages: number
          total_client_messages: number
        }[]
      }
      get_channel_unread_count: {
        Args: { _channel_id: string; _user_id: string }
        Returns: number
      }
      get_client_acquisition: {
        Args: { _agency_id: string; _months?: number }
        Returns: {
          month: string
          month_num: number
          new_clients: number
          year: number
        }[]
      }
      get_monthly_earnings: {
        Args: { _agency_id: string; _months?: number }
        Returns: {
          earnings: number
          month: string
          month_num: number
          projects_completed: number
          year: number
        }[]
      }
      get_or_create_dm_channel: {
        Args: { _agency_id: string; _other_user_id: string }
        Returns: string
      }
      get_user_agency_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_channel_member: {
        Args: { _channel_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_editor: {
        Args: { _project_id: string; _user_id: string }
        Returns: boolean
      }
      project_belongs_to_agency: {
        Args: { _agency_id: string; _project_id: string }
        Returns: boolean
      }
      recalculate_agency_storage: { Args: never; Returns: undefined }
      user_belongs_to_agency: {
        Args: { _agency_id: string; _user_id: string }
        Returns: boolean
      }
      verify_invitation_token: {
        Args: { _token: string }
        Returns: {
          agency_name: string
          already_accepted: boolean
          email: string
          full_name: string
          role: Database["public"]["Enums"]["app_role"]
          valid: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "client" | "editor"
      channel_type: "dm" | "project"
      invoice_status: "unpaid" | "paid" | "overdue" | "pending"
      project_status:
        | "backlog"
        | "in_progress"
        | "review"
        | "done"
        | "proposal"
        | "cancelled"
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
      app_role: ["admin", "client", "editor"],
      channel_type: ["dm", "project"],
      invoice_status: ["unpaid", "paid", "overdue", "pending"],
      project_status: [
        "backlog",
        "in_progress",
        "review",
        "done",
        "proposal",
        "cancelled",
      ],
    },
  },
} as const
