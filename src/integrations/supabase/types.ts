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
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          id: string
          last_name: string | null
          onboarding_completed: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          onboarding_completed?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tax_activity_logs: {
        Row: {
          action: string
          company_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          user_id: string | null
        }
        Insert: {
          action: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Update: {
          action?: string
          company_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_alerts: {
        Row: {
          alert_type: Database["public"]["Enums"]["tax_alert_type"]
          company_id: string
          created_at: string
          generated_at: string
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          severity: Database["public"]["Enums"]["tax_alert_severity"]
          tax_period_id: string | null
          title: string
        }
        Insert: {
          alert_type: Database["public"]["Enums"]["tax_alert_type"]
          company_id: string
          created_at?: string
          generated_at?: string
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          severity?: Database["public"]["Enums"]["tax_alert_severity"]
          tax_period_id?: string | null
          title: string
        }
        Update: {
          alert_type?: Database["public"]["Enums"]["tax_alert_type"]
          company_id?: string
          created_at?: string
          generated_at?: string
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          severity?: Database["public"]["Enums"]["tax_alert_severity"]
          tax_period_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_alerts_tax_period_id_fkey"
            columns: ["tax_period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_companies: {
        Row: {
          active_period: string | null
          address: string | null
          business_activity: string | null
          business_name: string
          commune: string | null
          connection_status: Database["public"]["Enums"]["sii_connection_status"]
          created_at: string
          created_by: string | null
          fantasy_name: string | null
          id: string
          is_demo: boolean
          last_sync_at: string | null
          region: string | null
          rut: string
          updated_at: string
        }
        Insert: {
          active_period?: string | null
          address?: string | null
          business_activity?: string | null
          business_name: string
          commune?: string | null
          connection_status?: Database["public"]["Enums"]["sii_connection_status"]
          created_at?: string
          created_by?: string | null
          fantasy_name?: string | null
          id?: string
          is_demo?: boolean
          last_sync_at?: string | null
          region?: string | null
          rut: string
          updated_at?: string
        }
        Update: {
          active_period?: string | null
          address?: string | null
          business_activity?: string | null
          business_name?: string
          commune?: string | null
          connection_status?: Database["public"]["Enums"]["sii_connection_status"]
          created_at?: string
          created_by?: string | null
          fantasy_name?: string | null
          id?: string
          is_demo?: boolean
          last_sync_at?: string | null
          region?: string | null
          rut?: string
          updated_at?: string
        }
        Relationships: []
      }
      tax_company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string | null
          role: Database["public"]["Enums"]["app_company_role"]
          status: Database["public"]["Enums"]["company_member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_company_role"]
          status?: Database["public"]["Enums"]["company_member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string | null
          role?: Database["public"]["Enums"]["app_company_role"]
          status?: Database["public"]["Enums"]["company_member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_company_settings: {
        Row: {
          alerts_enabled: boolean
          company_id: string
          created_at: string
          currency: string
          email_alerts_enabled: boolean
          estimated_ppm_rate: number
          id: string
          monthly_sales_goal: number | null
          preventive_margin_percent: number
          reserved_amount: number
          timezone: string
          updated_at: string
          weekly_summary_enabled: boolean
        }
        Insert: {
          alerts_enabled?: boolean
          company_id: string
          created_at?: string
          currency?: string
          email_alerts_enabled?: boolean
          estimated_ppm_rate?: number
          id?: string
          monthly_sales_goal?: number | null
          preventive_margin_percent?: number
          reserved_amount?: number
          timezone?: string
          updated_at?: string
          weekly_summary_enabled?: boolean
        }
        Update: {
          alerts_enabled?: boolean
          company_id?: string
          created_at?: string
          currency?: string
          email_alerts_enabled?: boolean
          estimated_ppm_rate?: number
          id?: string
          monthly_sales_goal?: number | null
          preventive_margin_percent?: number
          reserved_amount?: number
          timezone?: string
          updated_at?: string
          weekly_summary_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tax_company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_documents: {
        Row: {
          company_id: string
          counterparty_name: string
          counterparty_rut: string | null
          created_at: string
          document_date: string
          document_direction: Database["public"]["Enums"]["tax_document_direction"]
          document_type: string
          exempt_amount: number
          external_id: string | null
          folio: number
          id: string
          net_amount: number
          raw_metadata: Json
          rcv_status: Database["public"]["Enums"]["tax_rcv_status"]
          source: Database["public"]["Enums"]["tax_data_source"]
          tax_period_id: string
          total_amount: number
          updated_at: string
          vat_amount: number
        }
        Insert: {
          company_id: string
          counterparty_name: string
          counterparty_rut?: string | null
          created_at?: string
          document_date: string
          document_direction: Database["public"]["Enums"]["tax_document_direction"]
          document_type: string
          exempt_amount?: number
          external_id?: string | null
          folio: number
          id?: string
          net_amount?: number
          raw_metadata?: Json
          rcv_status?: Database["public"]["Enums"]["tax_rcv_status"]
          source?: Database["public"]["Enums"]["tax_data_source"]
          tax_period_id: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Update: {
          company_id?: string
          counterparty_name?: string
          counterparty_rut?: string | null
          created_at?: string
          document_date?: string
          document_direction?: Database["public"]["Enums"]["tax_document_direction"]
          document_type?: string
          exempt_amount?: number
          external_id?: string | null
          folio?: number
          id?: string
          net_amount?: number
          raw_metadata?: Json
          rcv_status?: Database["public"]["Enums"]["tax_rcv_status"]
          source?: Database["public"]["Enums"]["tax_data_source"]
          tax_period_id?: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_documents_tax_period_id_fkey"
            columns: ["tax_period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_f29_history: {
        Row: {
          company_id: string
          created_at: string
          declaration_status: Database["public"]["Enums"]["tax_f29_status"]
          declared_ppm: number | null
          declared_total: number | null
          declared_vat: number | null
          declared_withholdings: number | null
          filed_at: string | null
          id: string
          raw_data: Json
          source: Database["public"]["Enums"]["tax_data_source"]
          tax_period_id: string
          updated_at: string
          vat_carryforward: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          declaration_status?: Database["public"]["Enums"]["tax_f29_status"]
          declared_ppm?: number | null
          declared_total?: number | null
          declared_vat?: number | null
          declared_withholdings?: number | null
          filed_at?: string | null
          id?: string
          raw_data?: Json
          source?: Database["public"]["Enums"]["tax_data_source"]
          tax_period_id: string
          updated_at?: string
          vat_carryforward?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          declaration_status?: Database["public"]["Enums"]["tax_f29_status"]
          declared_ppm?: number | null
          declared_total?: number | null
          declared_vat?: number | null
          declared_withholdings?: number | null
          filed_at?: string | null
          id?: string
          raw_data?: Json
          source?: Database["public"]["Enums"]["tax_data_source"]
          tax_period_id?: string
          updated_at?: string
          vat_carryforward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_f29_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_f29_history_tax_period_id_fkey"
            columns: ["tax_period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_monthly_summaries: {
        Row: {
          calculated_at: string
          company_id: string
          created_at: string
          estimated_new_carryforward: number
          estimated_ppm: number
          estimated_tax_total: number
          estimated_vat_payable: number
          estimated_withholdings: number
          exempt_purchases: number
          exempt_sales: number
          id: string
          invoice_sales: number
          net_purchases: number
          preventive_margin_amount: number
          previous_vat_carryforward: number
          projected_sales: number
          purchases_total: number
          receipt_sales: number
          recommended_reserve: number
          reserved_amount_snapshot: number
          sales_credit_notes: number
          sales_total: number
          source: Database["public"]["Enums"]["tax_data_source"]
          tax_period_id: string
          updated_at: string
          vat_credit: number
          vat_debit: number
        }
        Insert: {
          calculated_at?: string
          company_id: string
          created_at?: string
          estimated_new_carryforward?: number
          estimated_ppm?: number
          estimated_tax_total?: number
          estimated_vat_payable?: number
          estimated_withholdings?: number
          exempt_purchases?: number
          exempt_sales?: number
          id?: string
          invoice_sales?: number
          net_purchases?: number
          preventive_margin_amount?: number
          previous_vat_carryforward?: number
          projected_sales?: number
          purchases_total?: number
          receipt_sales?: number
          recommended_reserve?: number
          reserved_amount_snapshot?: number
          sales_credit_notes?: number
          sales_total?: number
          source?: Database["public"]["Enums"]["tax_data_source"]
          tax_period_id: string
          updated_at?: string
          vat_credit?: number
          vat_debit?: number
        }
        Update: {
          calculated_at?: string
          company_id?: string
          created_at?: string
          estimated_new_carryforward?: number
          estimated_ppm?: number
          estimated_tax_total?: number
          estimated_vat_payable?: number
          estimated_withholdings?: number
          exempt_purchases?: number
          exempt_sales?: number
          id?: string
          invoice_sales?: number
          net_purchases?: number
          preventive_margin_amount?: number
          previous_vat_carryforward?: number
          projected_sales?: number
          purchases_total?: number
          receipt_sales?: number
          recommended_reserve?: number
          reserved_amount_snapshot?: number
          sales_credit_notes?: number
          sales_total?: number
          source?: Database["public"]["Enums"]["tax_data_source"]
          tax_period_id?: string
          updated_at?: string
          vat_credit?: number
          vat_debit?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_monthly_summaries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_monthly_summaries_tax_period_id_fkey"
            columns: ["tax_period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_periods: {
        Row: {
          closed_at: string | null
          company_id: string
          confidence_level: Database["public"]["Enums"]["tax_confidence_level"]
          created_at: string
          data_source: Database["public"]["Enums"]["tax_data_source"]
          id: string
          last_calculated_at: string | null
          month: number
          period: string
          status: Database["public"]["Enums"]["tax_period_status"]
          updated_at: string
          year: number
        }
        Insert: {
          closed_at?: string | null
          company_id: string
          confidence_level?: Database["public"]["Enums"]["tax_confidence_level"]
          created_at?: string
          data_source?: Database["public"]["Enums"]["tax_data_source"]
          id?: string
          last_calculated_at?: string | null
          month: number
          period: string
          status?: Database["public"]["Enums"]["tax_period_status"]
          updated_at?: string
          year: number
        }
        Update: {
          closed_at?: string | null
          company_id?: string
          confidence_level?: Database["public"]["Enums"]["tax_confidence_level"]
          created_at?: string
          data_source?: Database["public"]["Enums"]["tax_data_source"]
          id?: string
          last_calculated_at?: string | null
          month?: number
          period?: string
          status?: Database["public"]["Enums"]["tax_period_status"]
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_periods_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_sales_goals: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          goal_amount: number
          id: string
          tax_period_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          goal_amount?: number
          id?: string
          tax_period_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          goal_amount?: number
          id?: string
          tax_period_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_sales_goals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_sales_goals_tax_period_id_fkey"
            columns: ["tax_period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_sync_runs: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          records_created: number
          records_received: number
          records_updated: number
          source: Database["public"]["Enums"]["tax_data_source"]
          started_at: string
          status: Database["public"]["Enums"]["tax_sync_status"]
          sync_type: Database["public"]["Enums"]["tax_sync_type"]
          tax_period_id: string | null
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          records_created?: number
          records_received?: number
          records_updated?: number
          source?: Database["public"]["Enums"]["tax_data_source"]
          started_at?: string
          status?: Database["public"]["Enums"]["tax_sync_status"]
          sync_type?: Database["public"]["Enums"]["tax_sync_type"]
          tax_period_id?: string | null
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          records_created?: number
          records_received?: number
          records_updated?: number
          source?: Database["public"]["Enums"]["tax_data_source"]
          started_at?: string
          status?: Database["public"]["Enums"]["tax_sync_status"]
          sync_type?: Database["public"]["Enums"]["tax_sync_type"]
          tax_period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_sync_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_sync_runs_tax_period_id_fkey"
            columns: ["tax_period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      normalize_rut: { Args: { _rut: string }; Returns: string }
    }
    Enums: {
      app_company_role: "owner" | "business_user" | "accountant" | "viewer"
      company_member_status: "invited" | "active" | "suspended" | "removed"
      sii_connection_status:
        | "disconnected"
        | "connecting"
        | "connected"
        | "stale"
        | "error"
      tax_alert_severity: "info" | "success" | "warning" | "critical"
      tax_alert_type:
        | "reserve_insufficient"
        | "goal_at_risk"
        | "goal_achieved"
        | "pending_purchases"
        | "stale_data"
        | "high_tax_projection"
        | "positive_carryforward"
      tax_confidence_level: "high" | "medium" | "low" | "unknown"
      tax_data_source: "mock" | "manual" | "gateway" | "sii" | "accountant"
      tax_document_direction: "sale" | "purchase"
      tax_f29_status:
        | "not_available"
        | "draft"
        | "filed"
        | "rectified"
        | "observed"
      tax_period_status: "open" | "estimated" | "reviewed" | "closed"
      tax_rcv_status:
        | "registered"
        | "pending"
        | "claimed"
        | "excluded"
        | "accepted"
        | "unknown"
      tax_sync_status: "pending" | "running" | "success" | "partial" | "failed"
      tax_sync_type:
        | "demo"
        | "manual"
        | "scheduled"
        | "login_refresh"
        | "gateway"
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
      app_company_role: ["owner", "business_user", "accountant", "viewer"],
      company_member_status: ["invited", "active", "suspended", "removed"],
      sii_connection_status: [
        "disconnected",
        "connecting",
        "connected",
        "stale",
        "error",
      ],
      tax_alert_severity: ["info", "success", "warning", "critical"],
      tax_alert_type: [
        "reserve_insufficient",
        "goal_at_risk",
        "goal_achieved",
        "pending_purchases",
        "stale_data",
        "high_tax_projection",
        "positive_carryforward",
      ],
      tax_confidence_level: ["high", "medium", "low", "unknown"],
      tax_data_source: ["mock", "manual", "gateway", "sii", "accountant"],
      tax_document_direction: ["sale", "purchase"],
      tax_f29_status: [
        "not_available",
        "draft",
        "filed",
        "rectified",
        "observed",
      ],
      tax_period_status: ["open", "estimated", "reviewed", "closed"],
      tax_rcv_status: [
        "registered",
        "pending",
        "claimed",
        "excluded",
        "accepted",
        "unknown",
      ],
      tax_sync_status: ["pending", "running", "success", "partial", "failed"],
      tax_sync_type: [
        "demo",
        "manual",
        "scheduled",
        "login_refresh",
        "gateway",
      ],
    },
  },
} as const
