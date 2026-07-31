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
          action_label: string | null
          action_route: string | null
          alert_type: Database["public"]["Enums"]["tax_alert_type"]
          company_id: string
          created_at: string
          generated_at: string
          id: string
          is_read: boolean
          message: string
          read_at: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["tax_alert_severity"]
          status: string
          tax_period_id: string | null
          title: string
        }
        Insert: {
          action_label?: string | null
          action_route?: string | null
          alert_type: Database["public"]["Enums"]["tax_alert_type"]
          company_id: string
          created_at?: string
          generated_at?: string
          id?: string
          is_read?: boolean
          message: string
          read_at?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["tax_alert_severity"]
          status?: string
          tax_period_id?: string | null
          title: string
        }
        Update: {
          action_label?: string | null
          action_route?: string | null
          alert_type?: Database["public"]["Enums"]["tax_alert_type"]
          company_id?: string
          created_at?: string
          generated_at?: string
          id?: string
          is_read?: boolean
          message?: string
          read_at?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["tax_alert_severity"]
          status?: string
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
      tax_carryforward_reconciliations: {
        Row: {
          calculated_previous_carryforward: number
          company_id: string
          created_at: string
          declared_previous_carryforward: number
          difference: number
          id: string
          notes: string | null
          previous_period: string
          status: string
          tax_period_id: string
          updated_at: string
        }
        Insert: {
          calculated_previous_carryforward: number
          company_id: string
          created_at?: string
          declared_previous_carryforward: number
          difference: number
          id?: string
          notes?: string | null
          previous_period: string
          status?: string
          tax_period_id: string
          updated_at?: string
        }
        Update: {
          calculated_previous_carryforward?: number
          company_id?: string
          created_at?: string
          declared_previous_carryforward?: number
          difference?: number
          id?: string
          notes?: string | null
          previous_period?: string
          status?: string
          tax_period_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_carryforward_reconciliations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_carryforward_reconciliations_tax_period_id_fkey"
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
          ppm_rate_confirmed: boolean
          preventive_margin_percent: number
          reserved_amount: number
          timezone: string
          updated_at: string
          weekly_summary_enabled: boolean
          weekly_sync_reminder_enabled: boolean
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
          ppm_rate_confirmed?: boolean
          preventive_margin_percent?: number
          reserved_amount?: number
          timezone?: string
          updated_at?: string
          weekly_summary_enabled?: boolean
          weekly_sync_reminder_enabled?: boolean
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
          ppm_rate_confirmed?: boolean
          preventive_margin_percent?: number
          reserved_amount?: number
          timezone?: string
          updated_at?: string
          weekly_summary_enabled?: boolean
          weekly_sync_reminder_enabled?: boolean
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
      tax_company_tax_parameters: {
        Row: {
          company_id: string
          confirmed: boolean
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          parameter_type: string
          source: string
          updated_at: string
          value: number
        }
        Insert: {
          company_id: string
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          parameter_type: string
          source?: string
          updated_at?: string
          value: number
        }
        Update: {
          company_id?: string
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          parameter_type?: string
          source?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_company_tax_parameters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_document_files: {
        Row: {
          byte_size: number | null
          company_id: string
          content_type: string | null
          counterparty_rut: string
          created_at: string
          credits_used: number
          direction: Database["public"]["Enums"]["tax_document_direction"]
          downloaded_at: string
          dte_code: number
          error_code: string | null
          file_kind: string
          folio: number
          id: string
          period: string
          requested_by: string | null
          sha256: string | null
          source_endpoint: string
          status: string
          storage_path: string | null
          tax_document_id: string | null
          updated_at: string
          validation: Json
          warnings: Json
          xml_fields: Json
        }
        Insert: {
          byte_size?: number | null
          company_id: string
          content_type?: string | null
          counterparty_rut?: string
          created_at?: string
          credits_used?: number
          direction: Database["public"]["Enums"]["tax_document_direction"]
          downloaded_at?: string
          dte_code: number
          error_code?: string | null
          file_kind: string
          folio: number
          id?: string
          period: string
          requested_by?: string | null
          sha256?: string | null
          source_endpoint: string
          status?: string
          storage_path?: string | null
          tax_document_id?: string | null
          updated_at?: string
          validation?: Json
          warnings?: Json
          xml_fields?: Json
        }
        Update: {
          byte_size?: number | null
          company_id?: string
          content_type?: string | null
          counterparty_rut?: string
          created_at?: string
          credits_used?: number
          direction?: Database["public"]["Enums"]["tax_document_direction"]
          downloaded_at?: string
          dte_code?: number
          error_code?: string | null
          file_kind?: string
          folio?: number
          id?: string
          period?: string
          requested_by?: string | null
          sha256?: string | null
          source_endpoint?: string
          status?: string
          storage_path?: string | null
          tax_document_id?: string | null
          updated_at?: string
          validation?: Json
          warnings?: Json
          xml_fields?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tax_document_files_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_document_files_tax_document_id_fkey"
            columns: ["tax_document_id"]
            isOneToOne: false
            referencedRelation: "tax_documents"
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
      tax_f29_extractions: {
        Row: {
          code_values: Json
          company_id: string
          confidence_level: string
          created_at: string
          declaration_date: string | null
          declaration_status: string | null
          extraction_status: string
          folio: string
          id: string
          is_rectification: boolean
          normalized_fields: Json
          parser_version: string
          pdf_page_count: number | null
          pdf_sha256: string | null
          pdf_storage_path: string | null
          period: string
          source: string
          superseded: boolean
          supersedes_folio: string | null
          tax_period_id: string | null
          updated_at: string
          validation_results: Json
          warnings: Json
        }
        Insert: {
          code_values?: Json
          company_id: string
          confidence_level?: string
          created_at?: string
          declaration_date?: string | null
          declaration_status?: string | null
          extraction_status?: string
          folio: string
          id?: string
          is_rectification?: boolean
          normalized_fields?: Json
          parser_version: string
          pdf_page_count?: number | null
          pdf_sha256?: string | null
          pdf_storage_path?: string | null
          period: string
          source?: string
          superseded?: boolean
          supersedes_folio?: string | null
          tax_period_id?: string | null
          updated_at?: string
          validation_results?: Json
          warnings?: Json
        }
        Update: {
          code_values?: Json
          company_id?: string
          confidence_level?: string
          created_at?: string
          declaration_date?: string | null
          declaration_status?: string | null
          extraction_status?: string
          folio?: string
          id?: string
          is_rectification?: boolean
          normalized_fields?: Json
          parser_version?: string
          pdf_page_count?: number | null
          pdf_sha256?: string | null
          pdf_storage_path?: string | null
          period?: string
          source?: string
          superseded?: boolean
          supersedes_folio?: string | null
          tax_period_id?: string | null
          updated_at?: string
          validation_results?: Json
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "tax_f29_extractions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_f29_extractions_tax_period_id_fkey"
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
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          declaration_status: Database["public"]["Enums"]["tax_f29_status"]
          declared_ppm: number | null
          declared_ppm_base: number | null
          declared_ppm_rate: number | null
          declared_total: number | null
          declared_vat: number | null
          declared_withholdings: number | null
          filed_at: string | null
          folio: string | null
          id: string
          new_vat_carryforward: number | null
          notes: string | null
          previous_vat_carryforward: number | null
          raw_data: Json
          source: Database["public"]["Enums"]["tax_data_source"]
          tax_period_id: string
          updated_at: string
          vat_carryforward: number | null
        }
        Insert: {
          company_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          declaration_status?: Database["public"]["Enums"]["tax_f29_status"]
          declared_ppm?: number | null
          declared_ppm_base?: number | null
          declared_ppm_rate?: number | null
          declared_total?: number | null
          declared_vat?: number | null
          declared_withholdings?: number | null
          filed_at?: string | null
          folio?: string | null
          id?: string
          new_vat_carryforward?: number | null
          notes?: string | null
          previous_vat_carryforward?: number | null
          raw_data?: Json
          source?: Database["public"]["Enums"]["tax_data_source"]
          tax_period_id: string
          updated_at?: string
          vat_carryforward?: number | null
        }
        Update: {
          company_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          declaration_status?: Database["public"]["Enums"]["tax_f29_status"]
          declared_ppm?: number | null
          declared_ppm_base?: number | null
          declared_ppm_rate?: number | null
          declared_total?: number | null
          declared_vat?: number | null
          declared_withholdings?: number | null
          filed_at?: string | null
          folio?: string | null
          id?: string
          new_vat_carryforward?: number | null
          notes?: string | null
          previous_vat_carryforward?: number | null
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
          calculation_status: string
          carryforward_known: boolean
          carryforward_source: string
          company_id: string
          confidence_level: string
          confidence_reasons: Json
          created_at: string
          declared_tax_total: number | null
          estimated_new_carryforward: number
          estimated_ppm: number
          estimated_tax_total: number
          estimated_vat_payable: number
          estimated_withholdings: number
          exempt_purchases: number
          exempt_sales: number
          f29_deviation_amount: number | null
          f29_deviation_measured_at: string | null
          f29_deviation_pct: number | null
          gross_vat_position: number
          id: string
          invoice_sales: number
          missing_components: Json
          net_purchases: number
          other_vat_credits: number
          other_vat_debits: number
          ppm_base_source: string | null
          ppm_rate: number | null
          ppm_source: string
          ppm_tax_base: number
          pre_f29_ppm: number | null
          pre_f29_tax_total: number | null
          pre_f29_vat_payable: number | null
          pre_f29_withholdings: number | null
          preventive_margin_amount: number
          preventive_margin_percent: number
          previous_vat_carryforward: number
          projected_sales: number
          projected_tax_max: number
          projected_tax_min: number
          projected_vat_debit: number
          purchases_total: number
          receipt_sales: number
          recommended_reserve: number
          reserved_amount_snapshot: number
          sales_credit_notes: number
          sales_source: string | null
          sales_total: number
          source: Database["public"]["Enums"]["tax_data_source"]
          special_adjustments_source: string | null
          special_credits: number
          special_debits: number
          tax_period_id: string
          total_vat_credits: number
          totals_source: string
          updated_at: string
          vat_credit: number
          vat_credit_potential: number
          vat_credit_source: string | null
          vat_debit: number
          vat_debit_source: string | null
          withholdings_source: string
        }
        Insert: {
          calculated_at?: string
          calculation_status?: string
          carryforward_known?: boolean
          carryforward_source?: string
          company_id: string
          confidence_level?: string
          confidence_reasons?: Json
          created_at?: string
          declared_tax_total?: number | null
          estimated_new_carryforward?: number
          estimated_ppm?: number
          estimated_tax_total?: number
          estimated_vat_payable?: number
          estimated_withholdings?: number
          exempt_purchases?: number
          exempt_sales?: number
          f29_deviation_amount?: number | null
          f29_deviation_measured_at?: string | null
          f29_deviation_pct?: number | null
          gross_vat_position?: number
          id?: string
          invoice_sales?: number
          missing_components?: Json
          net_purchases?: number
          other_vat_credits?: number
          other_vat_debits?: number
          ppm_base_source?: string | null
          ppm_rate?: number | null
          ppm_source?: string
          ppm_tax_base?: number
          pre_f29_ppm?: number | null
          pre_f29_tax_total?: number | null
          pre_f29_vat_payable?: number | null
          pre_f29_withholdings?: number | null
          preventive_margin_amount?: number
          preventive_margin_percent?: number
          previous_vat_carryforward?: number
          projected_sales?: number
          projected_tax_max?: number
          projected_tax_min?: number
          projected_vat_debit?: number
          purchases_total?: number
          receipt_sales?: number
          recommended_reserve?: number
          reserved_amount_snapshot?: number
          sales_credit_notes?: number
          sales_source?: string | null
          sales_total?: number
          source?: Database["public"]["Enums"]["tax_data_source"]
          special_adjustments_source?: string | null
          special_credits?: number
          special_debits?: number
          tax_period_id: string
          total_vat_credits?: number
          totals_source?: string
          updated_at?: string
          vat_credit?: number
          vat_credit_potential?: number
          vat_credit_source?: string | null
          vat_debit?: number
          vat_debit_source?: string | null
          withholdings_source?: string
        }
        Update: {
          calculated_at?: string
          calculation_status?: string
          carryforward_known?: boolean
          carryforward_source?: string
          company_id?: string
          confidence_level?: string
          confidence_reasons?: Json
          created_at?: string
          declared_tax_total?: number | null
          estimated_new_carryforward?: number
          estimated_ppm?: number
          estimated_tax_total?: number
          estimated_vat_payable?: number
          estimated_withholdings?: number
          exempt_purchases?: number
          exempt_sales?: number
          f29_deviation_amount?: number | null
          f29_deviation_measured_at?: string | null
          f29_deviation_pct?: number | null
          gross_vat_position?: number
          id?: string
          invoice_sales?: number
          missing_components?: Json
          net_purchases?: number
          other_vat_credits?: number
          other_vat_debits?: number
          ppm_base_source?: string | null
          ppm_rate?: number | null
          ppm_source?: string
          ppm_tax_base?: number
          pre_f29_ppm?: number | null
          pre_f29_tax_total?: number | null
          pre_f29_vat_payable?: number | null
          pre_f29_withholdings?: number | null
          preventive_margin_amount?: number
          preventive_margin_percent?: number
          previous_vat_carryforward?: number
          projected_sales?: number
          projected_tax_max?: number
          projected_tax_min?: number
          projected_vat_debit?: number
          purchases_total?: number
          receipt_sales?: number
          recommended_reserve?: number
          reserved_amount_snapshot?: number
          sales_credit_notes?: number
          sales_source?: string | null
          sales_total?: number
          source?: Database["public"]["Enums"]["tax_data_source"]
          special_adjustments_source?: string | null
          special_credits?: number
          special_debits?: number
          tax_period_id?: string
          total_vat_credits?: number
          totals_source?: string
          updated_at?: string
          vat_credit?: number
          vat_credit_potential?: number
          vat_credit_source?: string | null
          vat_debit?: number
          vat_debit_source?: string | null
          withholdings_source?: string
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
      tax_period_comparisons: {
        Row: {
          company_id: string
          created_at: string
          declared_ppm: number
          declared_total: number
          declared_vat: number
          declared_withholdings: number
          difference_percent: number | null
          difference_total: number
          estimated_ppm: number
          estimated_total: number
          estimated_vat: number
          estimated_withholdings: number
          explanation: string | null
          id: string
          tax_period_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          declared_ppm?: number
          declared_total?: number
          declared_vat?: number
          declared_withholdings?: number
          difference_percent?: number | null
          difference_total?: number
          estimated_ppm?: number
          estimated_total?: number
          estimated_vat?: number
          estimated_withholdings?: number
          explanation?: string | null
          id?: string
          tax_period_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          declared_ppm?: number
          declared_total?: number
          declared_vat?: number
          declared_withholdings?: number
          difference_percent?: number | null
          difference_total?: number
          estimated_ppm?: number
          estimated_total?: number
          estimated_vat?: number
          estimated_withholdings?: number
          explanation?: string | null
          id?: string
          tax_period_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_period_comparisons_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_period_comparisons_tax_period_id_fkey"
            columns: ["tax_period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_period_ppm_overrides: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          ppm_rate: number
          tax_period_id: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          ppm_rate: number
          tax_period_id: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          ppm_rate?: number
          tax_period_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_period_ppm_overrides_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_period_ppm_overrides_tax_period_id_fkey"
            columns: ["tax_period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_period_sync_state: {
        Row: {
          cache_hit_count: number
          company_id: string
          created_at: string
          data_through_date: string | null
          freshness_status: string
          id: string
          last_attempt_at: string | null
          last_cache_hit_at: string | null
          last_provider_request_at: string | null
          last_successful_sync_at: string | null
          last_sync_run_id: string | null
          last_trigger_type: string | null
          next_recommended_sync_at: string | null
          provider: string
          provider_request_count: number
          tax_period_id: string
          updated_at: string
        }
        Insert: {
          cache_hit_count?: number
          company_id: string
          created_at?: string
          data_through_date?: string | null
          freshness_status?: string
          id?: string
          last_attempt_at?: string | null
          last_cache_hit_at?: string | null
          last_provider_request_at?: string | null
          last_successful_sync_at?: string | null
          last_sync_run_id?: string | null
          last_trigger_type?: string | null
          next_recommended_sync_at?: string | null
          provider?: string
          provider_request_count?: number
          tax_period_id: string
          updated_at?: string
        }
        Update: {
          cache_hit_count?: number
          company_id?: string
          created_at?: string
          data_through_date?: string | null
          freshness_status?: string
          id?: string
          last_attempt_at?: string | null
          last_cache_hit_at?: string | null
          last_provider_request_at?: string | null
          last_successful_sync_at?: string | null
          last_sync_run_id?: string | null
          last_trigger_type?: string | null
          next_recommended_sync_at?: string | null
          provider?: string
          provider_request_count?: number
          tax_period_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_period_sync_state_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_period_sync_state_tax_period_id_fkey"
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
          closed_by: string | null
          company_id: string
          confidence_level: Database["public"]["Enums"]["tax_confidence_level"]
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          data_source: Database["public"]["Enums"]["tax_data_source"]
          id: string
          last_calculated_at: string | null
          month: number
          period: string
          rcv_summary: Json | null
          rcv_summary_updated_at: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          review_requested_at: string | null
          review_requested_by: string | null
          status: Database["public"]["Enums"]["tax_period_status"]
          updated_at: string
          year: number
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          company_id: string
          confidence_level?: Database["public"]["Enums"]["tax_confidence_level"]
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          data_source?: Database["public"]["Enums"]["tax_data_source"]
          id?: string
          last_calculated_at?: string | null
          month: number
          period: string
          rcv_summary?: Json | null
          rcv_summary_updated_at?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          review_requested_at?: string | null
          review_requested_by?: string | null
          status?: Database["public"]["Enums"]["tax_period_status"]
          updated_at?: string
          year: number
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          company_id?: string
          confidence_level?: Database["public"]["Enums"]["tax_confidence_level"]
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          data_source?: Database["public"]["Enums"]["tax_data_source"]
          id?: string
          last_calculated_at?: string | null
          month?: number
          period?: string
          rcv_summary?: Json | null
          rcv_summary_updated_at?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          review_requested_at?: string | null
          review_requested_by?: string | null
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
      tax_provider_snapshots: {
        Row: {
          company_id: string
          created_at: string
          id: string
          module: Database["public"]["Enums"]["sii_snapshot_module"]
          normalized_at: string | null
          payload: Json
          payload_checksum: string | null
          provider: Database["public"]["Enums"]["sii_provider"]
          provider_reference: string | null
          received_at: string
          sync_run_id: string | null
          tax_period_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          module: Database["public"]["Enums"]["sii_snapshot_module"]
          normalized_at?: string | null
          payload?: Json
          payload_checksum?: string | null
          provider?: Database["public"]["Enums"]["sii_provider"]
          provider_reference?: string | null
          received_at?: string
          sync_run_id?: string | null
          tax_period_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          module?: Database["public"]["Enums"]["sii_snapshot_module"]
          normalized_at?: string | null
          payload?: Json
          payload_checksum?: string | null
          provider?: Database["public"]["Enums"]["sii_provider"]
          provider_reference?: string | null
          received_at?: string
          sync_run_id?: string | null
          tax_period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_provider_snapshots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_provider_snapshots_sync_run_id_fkey"
            columns: ["sync_run_id"]
            isOneToOne: false
            referencedRelation: "tax_sync_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_provider_snapshots_tax_period_id_fkey"
            columns: ["tax_period_id"]
            isOneToOne: false
            referencedRelation: "tax_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_real_gateway_allowlist: {
        Row: {
          authorized_by: string | null
          company_id: string
          consent_version: string | null
          created_at: string
          enabled: boolean
          updated_at: string
        }
        Insert: {
          authorized_by?: string | null
          company_id: string
          consent_version?: string | null
          created_at?: string
          enabled?: boolean
          updated_at?: string
        }
        Update: {
          authorized_by?: string | null
          company_id?: string
          consent_version?: string | null
          created_at?: string
          enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_real_gateway_allowlist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
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
      tax_sii_connections: {
        Row: {
          auth_method: Database["public"]["Enums"]["sii_auth_method"]
          authorization_method: string
          authorized_rut: string | null
          automation_reason: string | null
          automation_status: string
          company_id: string
          connected_at: string | null
          consent_accepted_at: string | null
          consent_version: string | null
          created_at: string
          created_by: string | null
          disconnected_at: string | null
          id: string
          last_attempt_at: string | null
          last_error_code: string | null
          last_error_message: string | null
          last_successful_sync_at: string | null
          provider: Database["public"]["Enums"]["sii_provider"]
          provider_connection_ref: string | null
          session_expires_at: string | null
          status: Database["public"]["Enums"]["sii_connection_status"]
          sync_mode: string
          sync_mode_updated_at: string | null
          updated_at: string
        }
        Insert: {
          auth_method?: Database["public"]["Enums"]["sii_auth_method"]
          authorization_method?: string
          authorized_rut?: string | null
          automation_reason?: string | null
          automation_status?: string
          company_id: string
          connected_at?: string | null
          consent_accepted_at?: string | null
          consent_version?: string | null
          created_at?: string
          created_by?: string | null
          disconnected_at?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          last_successful_sync_at?: string | null
          provider?: Database["public"]["Enums"]["sii_provider"]
          provider_connection_ref?: string | null
          session_expires_at?: string | null
          status?: Database["public"]["Enums"]["sii_connection_status"]
          sync_mode?: string
          sync_mode_updated_at?: string | null
          updated_at?: string
        }
        Update: {
          auth_method?: Database["public"]["Enums"]["sii_auth_method"]
          authorization_method?: string
          authorized_rut?: string | null
          automation_reason?: string | null
          automation_status?: string
          company_id?: string
          connected_at?: string | null
          consent_accepted_at?: string | null
          consent_version?: string | null
          created_at?: string
          created_by?: string | null
          disconnected_at?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error_code?: string | null
          last_error_message?: string | null
          last_successful_sync_at?: string | null
          provider?: Database["public"]["Enums"]["sii_provider"]
          provider_connection_ref?: string | null
          session_expires_at?: string | null
          status?: Database["public"]["Enums"]["sii_connection_status"]
          sync_mode?: string
          sync_mode_updated_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_sii_connections_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_sync_plans: {
        Row: {
          actual_calls: number
          actual_credits: number
          calls_avoided_by_cache: number
          company_id: string
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_code: string | null
          execution_mode: string
          id: string
          in_progress: boolean
          plan: Json
          plan_status: string
          planned_calls: number
          planned_credit_max: number
          planned_credit_min: number
          requested_periods: string[]
          requires_credentials: boolean
          started_at: string
          unplanned_calls_blocked: number
        }
        Insert: {
          actual_calls?: number
          actual_credits?: number
          calls_avoided_by_cache?: number
          company_id: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          execution_mode?: string
          id?: string
          in_progress?: boolean
          plan?: Json
          plan_status?: string
          planned_calls?: number
          planned_credit_max?: number
          planned_credit_min?: number
          requested_periods?: string[]
          requires_credentials?: boolean
          started_at?: string
          unplanned_calls_blocked?: number
        }
        Update: {
          actual_calls?: number
          actual_credits?: number
          calls_avoided_by_cache?: number
          company_id?: string
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_code?: string | null
          execution_mode?: string
          id?: string
          in_progress?: boolean
          plan?: Json
          plan_status?: string
          planned_calls?: number
          planned_credit_max?: number
          planned_credit_min?: number
          requested_periods?: string[]
          requires_credentials?: boolean
          started_at?: string
          unplanned_calls_blocked?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_sync_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_sync_preferences: {
        Row: {
          authorization_created_at: string | null
          authorization_expires_at: string | null
          authorization_method: string
          authorization_reference: string | null
          authorization_revoked_at: string | null
          automation_error_code: string | null
          automation_schedule: string | null
          automation_status: string
          blocking_threshold_percent: number
          company_id: string
          created_at: string
          credits_month: string | null
          credits_used_current_month: number
          id: string
          last_automated_attempt_at: string | null
          last_automated_success_at: string | null
          last_provider_balance: number | null
          last_provider_balance_at: string | null
          last_reminder_at: string | null
          monthly_credit_budget: number | null
          next_reminder_at: string | null
          reminder_day_of_month: number
          reminder_dismissed_at: string | null
          reminder_enabled: boolean
          reminder_status: string
          sync_mode: string
          updated_at: string
          warning_threshold_percent: number
        }
        Insert: {
          authorization_created_at?: string | null
          authorization_expires_at?: string | null
          authorization_method?: string
          authorization_reference?: string | null
          authorization_revoked_at?: string | null
          automation_error_code?: string | null
          automation_schedule?: string | null
          automation_status?: string
          blocking_threshold_percent?: number
          company_id: string
          created_at?: string
          credits_month?: string | null
          credits_used_current_month?: number
          id?: string
          last_automated_attempt_at?: string | null
          last_automated_success_at?: string | null
          last_provider_balance?: number | null
          last_provider_balance_at?: string | null
          last_reminder_at?: string | null
          monthly_credit_budget?: number | null
          next_reminder_at?: string | null
          reminder_day_of_month?: number
          reminder_dismissed_at?: string | null
          reminder_enabled?: boolean
          reminder_status?: string
          sync_mode?: string
          updated_at?: string
          warning_threshold_percent?: number
        }
        Update: {
          authorization_created_at?: string | null
          authorization_expires_at?: string | null
          authorization_method?: string
          authorization_reference?: string | null
          authorization_revoked_at?: string | null
          automation_error_code?: string | null
          automation_schedule?: string | null
          automation_status?: string
          blocking_threshold_percent?: number
          company_id?: string
          created_at?: string
          credits_month?: string | null
          credits_used_current_month?: number
          id?: string
          last_automated_attempt_at?: string | null
          last_automated_success_at?: string | null
          last_provider_balance?: number | null
          last_provider_balance_at?: string | null
          last_reminder_at?: string | null
          monthly_credit_budget?: number | null
          next_reminder_at?: string | null
          reminder_day_of_month?: number
          reminder_dismissed_at?: string | null
          reminder_enabled?: boolean
          reminder_status?: string
          sync_mode?: string
          updated_at?: string
          warning_threshold_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_sync_preferences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_sync_runs: {
        Row: {
          actual_credits: number | null
          cache_hit: boolean
          company_id: string
          completed_at: string | null
          created_at: string
          credits_balance: number | null
          data_through_date: string | null
          detail_documents_received: number
          documents_persisted: number
          documents_rejected: number
          duration_ms: number | null
          error_code: string | null
          error_message: string | null
          estimated_credits: number | null
          id: string
          idempotency_key: string | null
          modules_completed: string[]
          modules_failed: string[]
          modules_from_cache: Database["public"]["Enums"]["sii_snapshot_module"][]
          modules_requested: string[]
          next_retry_at: string | null
          pages_requested: number
          provider_request_count: number
          proxy_used: boolean | null
          records_created: number
          records_received: number
          records_updated: number
          rejection_reasons: Json
          retry_count: number
          source: Database["public"]["Enums"]["tax_data_source"]
          started_at: string
          status: Database["public"]["Enums"]["tax_sync_status"]
          summary_documents_reported: number
          summary_totals: Json | null
          sync_type: Database["public"]["Enums"]["tax_sync_type"]
          tax_period_id: string | null
          trigger_type: Database["public"]["Enums"]["tax_sync_type"] | null
          triggered_by: string | null
        }
        Insert: {
          actual_credits?: number | null
          cache_hit?: boolean
          company_id: string
          completed_at?: string | null
          created_at?: string
          credits_balance?: number | null
          data_through_date?: string | null
          detail_documents_received?: number
          documents_persisted?: number
          documents_rejected?: number
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          estimated_credits?: number | null
          id?: string
          idempotency_key?: string | null
          modules_completed?: string[]
          modules_failed?: string[]
          modules_from_cache?: Database["public"]["Enums"]["sii_snapshot_module"][]
          modules_requested?: string[]
          next_retry_at?: string | null
          pages_requested?: number
          provider_request_count?: number
          proxy_used?: boolean | null
          records_created?: number
          records_received?: number
          records_updated?: number
          rejection_reasons?: Json
          retry_count?: number
          source?: Database["public"]["Enums"]["tax_data_source"]
          started_at?: string
          status?: Database["public"]["Enums"]["tax_sync_status"]
          summary_documents_reported?: number
          summary_totals?: Json | null
          sync_type?: Database["public"]["Enums"]["tax_sync_type"]
          tax_period_id?: string | null
          trigger_type?: Database["public"]["Enums"]["tax_sync_type"] | null
          triggered_by?: string | null
        }
        Update: {
          actual_credits?: number | null
          cache_hit?: boolean
          company_id?: string
          completed_at?: string | null
          created_at?: string
          credits_balance?: number | null
          data_through_date?: string | null
          detail_documents_received?: number
          documents_persisted?: number
          documents_rejected?: number
          duration_ms?: number | null
          error_code?: string | null
          error_message?: string | null
          estimated_credits?: number | null
          id?: string
          idempotency_key?: string | null
          modules_completed?: string[]
          modules_failed?: string[]
          modules_from_cache?: Database["public"]["Enums"]["sii_snapshot_module"][]
          modules_requested?: string[]
          next_retry_at?: string | null
          pages_requested?: number
          provider_request_count?: number
          proxy_used?: boolean | null
          records_created?: number
          records_received?: number
          records_updated?: number
          rejection_reasons?: Json
          retry_count?: number
          source?: Database["public"]["Enums"]["tax_data_source"]
          started_at?: string
          status?: Database["public"]["Enums"]["tax_sync_status"]
          summary_documents_reported?: number
          summary_totals?: Json | null
          sync_type?: Database["public"]["Enums"]["tax_sync_type"]
          tax_period_id?: string | null
          trigger_type?: Database["public"]["Enums"]["tax_sync_type"] | null
          triggered_by?: string | null
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
      tax_validation_runs: {
        Row: {
          actual_credits: number
          cache_hits: number
          calls: Json
          codes_found: Json
          codes_missing: Json
          company_id: string
          created_at: string
          created_by: string | null
          credits_balance: number | null
          declared_total: number | null
          difference: number | null
          difference_percentage: number | null
          document_results: Json
          error_code: string | null
          error_message: string | null
          estimated_total: number | null
          explanation_codes: Json
          f29_confidence: string | null
          f29_extraction_status: string | null
          f29_folio: string | null
          f29_found: boolean
          f29_pdf_archived: boolean
          id: string
          period: string
          prevented_provider_calls: number
          provider_requests: number
          selected_documents: Json
          stage: string | null
          status: string
          tax_period_id: string | null
          updated_at: string
          validation_type: string
        }
        Insert: {
          actual_credits?: number
          cache_hits?: number
          calls?: Json
          codes_found?: Json
          codes_missing?: Json
          company_id: string
          created_at?: string
          created_by?: string | null
          credits_balance?: number | null
          declared_total?: number | null
          difference?: number | null
          difference_percentage?: number | null
          document_results?: Json
          error_code?: string | null
          error_message?: string | null
          estimated_total?: number | null
          explanation_codes?: Json
          f29_confidence?: string | null
          f29_extraction_status?: string | null
          f29_folio?: string | null
          f29_found?: boolean
          f29_pdf_archived?: boolean
          id?: string
          period: string
          prevented_provider_calls?: number
          provider_requests?: number
          selected_documents?: Json
          stage?: string | null
          status?: string
          tax_period_id?: string | null
          updated_at?: string
          validation_type: string
        }
        Update: {
          actual_credits?: number
          cache_hits?: number
          calls?: Json
          codes_found?: Json
          codes_missing?: Json
          company_id?: string
          created_at?: string
          created_by?: string | null
          credits_balance?: number | null
          declared_total?: number | null
          difference?: number | null
          difference_percentage?: number | null
          document_results?: Json
          error_code?: string | null
          error_message?: string | null
          estimated_total?: number | null
          explanation_codes?: Json
          f29_confidence?: string | null
          f29_extraction_status?: string | null
          f29_folio?: string | null
          f29_found?: boolean
          f29_pdf_archived?: boolean
          id?: string
          period?: string
          prevented_provider_calls?: number
          provider_requests?: number
          selected_documents?: Json
          stage?: string | null
          status?: string
          tax_period_id?: string | null
          updated_at?: string
          validation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tax_validation_runs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "tax_companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_validation_runs_tax_period_id_fkey"
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
      sii_auth_method: "demo" | "tax_key" | "certificate"
      sii_connection_status:
        | "disconnected"
        | "connecting"
        | "connected"
        | "stale"
        | "error"
      sii_provider: "mock" | "api_gateway"
      sii_snapshot_module:
        | "rcv_sales_summary"
        | "rcv_sales_documents"
        | "rcv_purchases_registered"
        | "rcv_purchases_pending"
        | "rcv_purchases_claimed"
        | "rcv_purchases_excluded"
        | "f29_periods"
        | "f29_detail"
        | "withholdings"
        | "f29_compact_pdf"
      tax_alert_severity: "info" | "success" | "warning" | "critical"
      tax_alert_type:
        | "reserve_insufficient"
        | "goal_at_risk"
        | "goal_achieved"
        | "pending_purchases"
        | "stale_data"
        | "high_tax_projection"
        | "positive_carryforward"
        | "period_ready_to_close"
        | "f29_confirmation_pending"
        | "weekly_update_due"
        | "declared_vs_estimated_difference"
      tax_confidence_level: "high" | "medium" | "low" | "unknown"
      tax_data_source:
        | "mock"
        | "manual"
        | "gateway"
        | "sii"
        | "accountant"
        | "mock_gateway"
        | "api_gateway"
        | "f29_pdf_extracted"
      tax_document_direction: "sale" | "purchase"
      tax_f29_status:
        | "not_available"
        | "draft"
        | "filed"
        | "rectified"
        | "observed"
      tax_period_status:
        | "open"
        | "estimated"
        | "reviewed"
        | "closed"
        | "pending_review"
        | "confirmed"
        | "reopened"
      tax_rcv_status:
        | "registered"
        | "pending"
        | "claimed"
        | "excluded"
        | "accepted"
        | "unknown"
      tax_sync_status:
        | "pending"
        | "running"
        | "success"
        | "partial"
        | "failed"
        | "skipped"
      tax_sync_type:
        | "demo"
        | "manual"
        | "scheduled"
        | "login_refresh"
        | "gateway"
        | "demo_connect"
        | "weekly_refresh"
        | "retry"
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
      sii_auth_method: ["demo", "tax_key", "certificate"],
      sii_connection_status: [
        "disconnected",
        "connecting",
        "connected",
        "stale",
        "error",
      ],
      sii_provider: ["mock", "api_gateway"],
      sii_snapshot_module: [
        "rcv_sales_summary",
        "rcv_sales_documents",
        "rcv_purchases_registered",
        "rcv_purchases_pending",
        "rcv_purchases_claimed",
        "rcv_purchases_excluded",
        "f29_periods",
        "f29_detail",
        "withholdings",
        "f29_compact_pdf",
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
        "period_ready_to_close",
        "f29_confirmation_pending",
        "weekly_update_due",
        "declared_vs_estimated_difference",
      ],
      tax_confidence_level: ["high", "medium", "low", "unknown"],
      tax_data_source: [
        "mock",
        "manual",
        "gateway",
        "sii",
        "accountant",
        "mock_gateway",
        "api_gateway",
        "f29_pdf_extracted",
      ],
      tax_document_direction: ["sale", "purchase"],
      tax_f29_status: [
        "not_available",
        "draft",
        "filed",
        "rectified",
        "observed",
      ],
      tax_period_status: [
        "open",
        "estimated",
        "reviewed",
        "closed",
        "pending_review",
        "confirmed",
        "reopened",
      ],
      tax_rcv_status: [
        "registered",
        "pending",
        "claimed",
        "excluded",
        "accepted",
        "unknown",
      ],
      tax_sync_status: [
        "pending",
        "running",
        "success",
        "partial",
        "failed",
        "skipped",
      ],
      tax_sync_type: [
        "demo",
        "manual",
        "scheduled",
        "login_refresh",
        "gateway",
        "demo_connect",
        "weekly_refresh",
        "retry",
      ],
    },
  },
} as const
