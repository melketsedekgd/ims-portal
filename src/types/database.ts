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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      actions: {
        Row: {
          completed_date: string | null
          completion_percentage: number | null
          created_at: string
          created_by: string | null
          department_id: string
          description: string | null
          due_date: string | null
          id: string
          owner_title: string | null
          priority: number | null
          source_id: string | null
          source_type: Database["public"]["Enums"]["action_source"]
          start_date: string | null
          status: Database["public"]["Enums"]["action_status"]
          title: string
          updated_at: string
        }
        Insert: {
          completed_date?: string | null
          completion_percentage?: number | null
          created_at?: string
          created_by?: string | null
          department_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_title?: string | null
          priority?: number | null
          source_id?: string | null
          source_type: Database["public"]["Enums"]["action_source"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          title: string
          updated_at?: string
        }
        Update: {
          completed_date?: string | null
          completion_percentage?: number | null
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          owner_title?: string | null
          priority?: number | null
          source_id?: string | null
          source_type?: Database["public"]["Enums"]["action_source"]
          start_date?: string | null
          status?: Database["public"]["Enums"]["action_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "actions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "actions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          effective_from: string
          effective_to: string | null
          id: string
          name: string
          parent_department_id: string | null
          status: Database["public"]["Enums"]["department_status"]
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          name: string
          parent_department_id?: string | null
          status?: Database["public"]["Enums"]["department_status"]
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          name?: string
          parent_department_id?: string | null
          status?: Database["public"]["Enums"]["department_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_department_id_fkey"
            columns: ["parent_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      document_change_approvals: {
        Row: {
          decided_at: string
          decided_by: string
          decision: Database["public"]["Enums"]["approval_decision"]
          id: string
          reason: string | null
          request_id: string
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Insert: {
          decided_at?: string
          decided_by: string
          decision: Database["public"]["Enums"]["approval_decision"]
          id?: string
          reason?: string | null
          request_id: string
          stage: Database["public"]["Enums"]["approval_stage"]
        }
        Update: {
          decided_at?: string
          decided_by?: string
          decision?: Database["public"]["Enums"]["approval_decision"]
          id?: string
          reason?: string | null
          request_id?: string
          stage?: Database["public"]["Enums"]["approval_stage"]
        }
        Relationships: [
          {
            foreignKeyName: "document_change_approvals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_change_approvals_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_change_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      document_change_requests: {
        Row: {
          affected_processes: string | null
          created_at: string
          description_of_change: string
          document_id: string
          id: string
          proposed_effective_date: string | null
          proposed_revision: string
          reason_for_change: string
          related_iso_requirements: string | null
          requester_id: string
          status: Database["public"]["Enums"]["change_request_status"]
          updated_at: string
        }
        Insert: {
          affected_processes?: string | null
          created_at?: string
          description_of_change: string
          document_id: string
          id?: string
          proposed_effective_date?: string | null
          proposed_revision: string
          reason_for_change: string
          related_iso_requirements?: string | null
          requester_id: string
          status?: Database["public"]["Enums"]["change_request_status"]
          updated_at?: string
        }
        Update: {
          affected_processes?: string | null
          created_at?: string
          description_of_change?: string
          document_id?: string
          id?: string
          proposed_effective_date?: string | null
          proposed_revision?: string
          reason_for_change?: string
          related_iso_requirements?: string | null
          requester_id?: string
          status?: Database["public"]["Enums"]["change_request_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_change_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_change_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_revisions: {
        Row: {
          change_request_id: string | null
          document_id: string
          id: string
          published_at: string
          published_by: string
          revision_label: string
        }
        Insert: {
          change_request_id?: string | null
          document_id: string
          id?: string
          published_at?: string
          published_by: string
          revision_label: string
        }
        Update: {
          change_request_id?: string | null
          document_id?: string
          id?: string
          published_at?: string
          published_by?: string
          revision_label?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_revisions_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "document_change_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_revisions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_revisions_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          current_revision: string | null
          department_id: string
          document_number: string | null
          id: string
          name: string
          owner_id: string | null
          process_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          storage_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_revision?: string | null
          department_id: string
          document_number?: string | null
          id?: string
          name: string
          owner_id?: string | null
          process_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_revision?: string | null
          department_id?: string
          document_number?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          process_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          storage_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          created_at: string
          department_id: string
          id: string
          linked_id: string
          linked_type: Database["public"]["Enums"]["action_source"]
          location: string | null
          name: string
          source: string
          type: Database["public"]["Enums"]["evidence_type"]
          updated_at: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          linked_id: string
          linked_type: Database["public"]["Enums"]["action_source"]
          location?: string | null
          name: string
          source?: string
          type: Database["public"]["Enums"]["evidence_type"]
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          linked_id?: string
          linked_type?: Database["public"]["Enums"]["action_source"]
          location?: string | null
          name?: string
          source?: string
          type?: Database["public"]["Enums"]["evidence_type"]
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_measurements: {
        Row: {
          achievement_override: number | null
          actual_text: string | null
          actual_unit: string | null
          actual_value: number | null
          evidence_reference: string | null
          id: string
          kpi_id: string
          not_measured: boolean
          overridden_at: string | null
          overridden_by: string | null
          override_reason: string | null
          recorded_at: string
          recorded_by: string | null
          remark: string | null
          reporting_period_id: string
          target_direction:
            | Database["public"]["Enums"]["target_direction"]
            | null
          target_unit: string | null
          target_value: number | null
          updated_at: string
        }
        Insert: {
          achievement_override?: number | null
          actual_text?: string | null
          actual_unit?: string | null
          actual_value?: number | null
          evidence_reference?: string | null
          id?: string
          kpi_id: string
          not_measured?: boolean
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          recorded_at?: string
          recorded_by?: string | null
          remark?: string | null
          reporting_period_id: string
          target_direction?:
            | Database["public"]["Enums"]["target_direction"]
            | null
          target_unit?: string | null
          target_value?: number | null
          updated_at?: string
        }
        Update: {
          achievement_override?: number | null
          actual_text?: string | null
          actual_unit?: string | null
          actual_value?: number | null
          evidence_reference?: string | null
          id?: string
          kpi_id?: string
          not_measured?: boolean
          overridden_at?: string | null
          overridden_by?: string | null
          override_reason?: string | null
          recorded_at?: string
          recorded_by?: string | null
          remark?: string | null
          reporting_period_id?: string
          target_direction?:
            | Database["public"]["Enums"]["target_direction"]
            | null
          target_unit?: string | null
          target_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_measurements_actual_unit_fkey"
            columns: ["actual_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "kpi_measurements_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_measurements_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_measurements_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_measurements_reporting_period_id_fkey"
            columns: ["reporting_period_id"]
            isOneToOne: false
            referencedRelation: "reporting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_measurements_target_unit_fkey"
            columns: ["target_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["key"]
          },
        ]
      }
      kpis: {
        Row: {
          aggregation_method: Database["public"]["Enums"]["aggregation_method"]
          analysis_methodology: string | null
          created_at: string
          created_by: string | null
          data_source: string | null
          department_id: string
          description: string | null
          display_order: number | null
          id: string
          measurement_frequency: Database["public"]["Enums"]["period_type"]
          name: string
          parent_kpi_id: string | null
          process_id: string | null
          reporting_frequency: Database["public"]["Enums"]["period_type"]
          responsibility_title: string | null
          retired_at: string | null
          status: Database["public"]["Enums"]["kpi_status"]
          target_direction: Database["public"]["Enums"]["target_direction"]
          target_text: string | null
          target_unit: string | null
          target_value: number | null
          updated_at: string
        }
        Insert: {
          aggregation_method?: Database["public"]["Enums"]["aggregation_method"]
          analysis_methodology?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string | null
          department_id: string
          description?: string | null
          display_order?: number | null
          id?: string
          measurement_frequency: Database["public"]["Enums"]["period_type"]
          name: string
          parent_kpi_id?: string | null
          process_id?: string | null
          reporting_frequency?: Database["public"]["Enums"]["period_type"]
          responsibility_title?: string | null
          retired_at?: string | null
          status?: Database["public"]["Enums"]["kpi_status"]
          target_direction: Database["public"]["Enums"]["target_direction"]
          target_text?: string | null
          target_unit?: string | null
          target_value?: number | null
          updated_at?: string
        }
        Update: {
          aggregation_method?: Database["public"]["Enums"]["aggregation_method"]
          analysis_methodology?: string | null
          created_at?: string
          created_by?: string | null
          data_source?: string | null
          department_id?: string
          description?: string | null
          display_order?: number | null
          id?: string
          measurement_frequency?: Database["public"]["Enums"]["period_type"]
          name?: string
          parent_kpi_id?: string | null
          process_id?: string | null
          reporting_frequency?: Database["public"]["Enums"]["period_type"]
          responsibility_title?: string | null
          retired_at?: string | null
          status?: Database["public"]["Enums"]["kpi_status"]
          target_direction?: Database["public"]["Enums"]["target_direction"]
          target_text?: string | null
          target_unit?: string | null
          target_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpis_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_parent_kpi_id_fkey"
            columns: ["parent_kpi_id"]
            isOneToOne: false
            referencedRelation: "kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpis_target_unit_fkey"
            columns: ["target_unit"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["key"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          email_attempted_at: string | null
          email_error: string | null
          id: string
          link: string
          read_at: string | null
          recipient_id: string
          subject_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          email_attempted_at?: string | null
          email_error?: string | null
          id?: string
          link: string
          read_at?: string | null
          recipient_id: string
          subject_id: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          email_attempted_at?: string | null
          email_error?: string | null
          id?: string
          link?: string
          read_at?: string | null
          recipient_id?: string
          subject_id?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      objective_activities: {
        Row: {
          completed_date: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          objective_id: string
          owner_title: string | null
          planned_completion_date: string | null
          planned_start_date: string | null
          status: Database["public"]["Enums"]["activity_status"]
          title: string
          updated_at: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          objective_id: string
          owner_title?: string | null
          planned_completion_date?: string | null
          planned_start_date?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          title: string
          updated_at?: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          objective_id?: string
          owner_title?: string | null
          planned_completion_date?: string | null
          planned_start_date?: string | null
          status?: Database["public"]["Enums"]["activity_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objective_activities_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      objective_measurements: {
        Row: {
          achievement: number | null
          activities_completed: number | null
          activities_total: number | null
          evidence_reference: string | null
          followup_action: string | null
          id: string
          not_measured: boolean
          objective_id: string
          reason_for_deviation: string | null
          recorded_at: string
          recorded_by: string | null
          reporting_period_id: string
          updated_at: string
        }
        Insert: {
          achievement?: number | null
          activities_completed?: number | null
          activities_total?: number | null
          evidence_reference?: string | null
          followup_action?: string | null
          id?: string
          not_measured?: boolean
          objective_id: string
          reason_for_deviation?: string | null
          recorded_at?: string
          recorded_by?: string | null
          reporting_period_id: string
          updated_at?: string
        }
        Update: {
          achievement?: number | null
          activities_completed?: number | null
          activities_total?: number | null
          evidence_reference?: string | null
          followup_action?: string | null
          id?: string
          not_measured?: boolean
          objective_id?: string
          reason_for_deviation?: string | null
          recorded_at?: string
          recorded_by?: string | null
          reporting_period_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objective_measurements_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "objectives"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objective_measurements_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objective_measurements_reporting_period_id_fkey"
            columns: ["reporting_period_id"]
            isOneToOne: false
            referencedRelation: "reporting_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      objectives: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          description: string | null
          id: string
          owner_title: string | null
          process_id: string | null
          reference_number: number | null
          retired_at: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["objective_status"]
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          description?: string | null
          id?: string
          owner_title?: string | null
          process_id?: string | null
          reference_number?: number | null
          retired_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string | null
          id?: string
          owner_title?: string | null
          process_id?: string | null
          reference_number?: number | null
          retired_at?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["objective_status"]
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objectives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "objectives_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_settings: {
        Row: {
          created_at: string
          fiscal_year_start_month: number
          id: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          fiscal_year_start_month?: number
          id?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          fiscal_year_start_month?: number
          id?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      processes: {
        Row: {
          created_at: string
          department_id: string
          description: string | null
          display_order: number | null
          governing_document: string | null
          id: string
          name: string
          status: Database["public"]["Enums"]["process_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          description?: string | null
          display_order?: number | null
          governing_document?: string | null
          id?: string
          name: string
          status?: Database["public"]["Enums"]["process_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          description?: string | null
          display_order?: number | null
          governing_document?: string | null
          id?: string
          name?: string
          status?: Database["public"]["Enums"]["process_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "processes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          job_title: string | null
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id: string
          job_title?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          job_title?: string | null
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      reporting_periods: {
        Row: {
          created_at: string
          end_date: string
          id: string
          label: string
          start_date: string
          status: Database["public"]["Enums"]["period_status"]
          type: Database["public"]["Enums"]["period_type"]
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          end_date: string
          id?: string
          label: string
          start_date: string
          status?: Database["public"]["Enums"]["period_status"]
          type: Database["public"]["Enums"]["period_type"]
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          end_date?: string
          id?: string
          label?: string
          start_date?: string
          status?: Database["public"]["Enums"]["period_status"]
          type?: Database["public"]["Enums"]["period_type"]
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      risk_assessments: {
        Row: {
          assessed_at: string
          assessed_by: string | null
          id: string
          likelihood: number
          notes: string | null
          reporting_period_id: string | null
          risk_id: string
          rpn: number | null
          severity: number
          type: Database["public"]["Enums"]["assessment_type"]
        }
        Insert: {
          assessed_at?: string
          assessed_by?: string | null
          id?: string
          likelihood: number
          notes?: string | null
          reporting_period_id?: string | null
          risk_id: string
          rpn?: number | null
          severity: number
          type: Database["public"]["Enums"]["assessment_type"]
        }
        Update: {
          assessed_at?: string
          assessed_by?: string | null
          id?: string
          likelihood?: number
          notes?: string | null
          reporting_period_id?: string | null
          risk_id?: string
          rpn?: number | null
          severity?: number
          type?: Database["public"]["Enums"]["assessment_type"]
        }
        Relationships: [
          {
            foreignKeyName: "risk_assessments_assessed_by_fkey"
            columns: ["assessed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_reporting_period_id_fkey"
            columns: ["reporting_period_id"]
            isOneToOne: false
            referencedRelation: "reporting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_assessments_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_treatment_reviews: {
        Row: {
          effectiveness:
            | Database["public"]["Enums"]["treatment_effectiveness"]
            | null
          followup_measure: string | null
          id: string
          reason_for_deviation: string | null
          reporting_period_id: string
          reviewed_at: string
          reviewed_by: string | null
          solution_evidence: string | null
          treatment_id: string
        }
        Insert: {
          effectiveness?:
            | Database["public"]["Enums"]["treatment_effectiveness"]
            | null
          followup_measure?: string | null
          id?: string
          reason_for_deviation?: string | null
          reporting_period_id: string
          reviewed_at?: string
          reviewed_by?: string | null
          solution_evidence?: string | null
          treatment_id: string
        }
        Update: {
          effectiveness?:
            | Database["public"]["Enums"]["treatment_effectiveness"]
            | null
          followup_measure?: string | null
          id?: string
          reason_for_deviation?: string | null
          reporting_period_id?: string
          reviewed_at?: string
          reviewed_by?: string | null
          solution_evidence?: string | null
          treatment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_treatment_reviews_reporting_period_id_fkey"
            columns: ["reporting_period_id"]
            isOneToOne: false
            referencedRelation: "reporting_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_treatment_reviews_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_treatment_reviews_treatment_id_fkey"
            columns: ["treatment_id"]
            isOneToOne: false
            referencedRelation: "risk_treatments"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_treatments: {
        Row: {
          completed_date: string | null
          created_at: string
          created_by: string | null
          id: string
          monitoring_evidence: string | null
          owner_title: string | null
          risk_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["treatment_status"]
          target_date: string | null
          treatment_solution: string
          updated_at: string
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          monitoring_evidence?: string | null
          owner_title?: string | null
          risk_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["treatment_status"]
          target_date?: string | null
          treatment_solution: string
          updated_at?: string
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          monitoring_evidence?: string | null
          owner_title?: string | null
          risk_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["treatment_status"]
          target_date?: string | null
          treatment_solution?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "risk_treatments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risk_treatments_risk_id_fkey"
            columns: ["risk_id"]
            isOneToOne: false
            referencedRelation: "risks"
            referencedColumns: ["id"]
          },
        ]
      }
      risks: {
        Row: {
          affected_assets: string
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          process_id: string | null
          reference_number: number | null
          risk_owner_title: string | null
          risk_statement: string | null
          status: Database["public"]["Enums"]["risk_status"]
          threat: string | null
          updated_at: string
          vulnerability: string | null
        }
        Insert: {
          affected_assets: string
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          process_id?: string | null
          reference_number?: number | null
          risk_owner_title?: string | null
          risk_statement?: string | null
          status?: Database["public"]["Enums"]["risk_status"]
          threat?: string | null
          updated_at?: string
          vulnerability?: string | null
        }
        Update: {
          affected_assets?: string
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          process_id?: string | null
          reference_number?: number | null
          risk_owner_title?: string | null
          risk_statement?: string | null
          status?: Database["public"]["Enums"]["risk_status"]
          threat?: string | null
          updated_at?: string
          vulnerability?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "risks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "risks_process_id_fkey"
            columns: ["process_id"]
            isOneToOne: false
            referencedRelation: "processes"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
        }
        Relationships: []
      }
      units: {
        Row: {
          created_at: string
          dimension: string
          factor_to_base: number
          key: string
          label: string
        }
        Insert: {
          created_at?: string
          dimension: string
          factor_to_base: number
          key: string
          label: string
        }
        Update: {
          created_at?: string
          dimension?: string
          factor_to_base?: number
          key?: string
          label?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          department_id: string | null
          id: string
          profile_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          id?: string
          profile_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          id?: string
          profile_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_open_action_items: {
        Row: {
          department_id: string | null
          department_name: string | null
          description: string | null
          due_date: string | null
          id: string | null
          kind: string | null
          owner_title: string | null
          parent_id: string | null
          parent_type: string | null
          priority: number | null
          status: string | null
          title: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_review_document: { Args: { doc: string }; Returns: boolean }
      create_objective_with_activities: {
        Args: {
          p_activities: Json
          p_department_id: string
          p_description: string
          p_owner_title: string
          p_process_id: string
          p_start_date: string
          p_target_date: string
          p_title: string
        }
        Returns: string
      }
      department_of: { Args: { p_id: string; p_type: string }; Returns: string }
      has_role: { Args: { role_keys: string[] }; Returns: boolean }
      is_ims: { Args: never; Returns: boolean }
      is_ims_admin: { Args: never; Returns: boolean }
      kpi_achievement_ratio: {
        Args: { m: Database["public"]["Tables"]["kpi_measurements"]["Row"] }
        Returns: number
      }
      kpi_computed_ratio: {
        Args: { m: Database["public"]["Tables"]["kpi_measurements"]["Row"] }
        Returns: number
      }
      my_department_ids: { Args: never; Returns: string[] }
      my_managed_department_ids: { Args: never; Returns: string[] }
      objective_achievement: { Args: { objective: string }; Returns: number }
      owner_stage_reviewers: { Args: { doc: string }; Returns: string[] }
      raise_change_request: {
        Args: {
          p_affected_processes: string
          p_department_id: string
          p_description: string
          p_document_id: string
          p_document_name: string
          p_document_number: string
          p_effective_date: string
          p_iso_refs: string
          p_proposed_revision: string
          p_reason: string
          p_storage_url: string
        }
        Returns: string
      }
    }
    Enums: {
      action_source:
        | "risk"
        | "risk_treatment"
        | "risk_treatment_review"
        | "kpi"
        | "kpi_measurement"
        | "objective"
        | "objective_measurement"
        | "document_change"
        | "other"
        | "action"
      action_status:
        | "open"
        | "in_progress"
        | "blocked"
        | "completed"
        | "cancelled"
      activity_status: "not_started" | "in_progress" | "completed" | "cancelled"
      aggregation_method: "average" | "sum" | "min" | "max" | "latest"
      approval_decision: "approved" | "rejected"
      approval_stage: "owner" | "ims"
      assessment_type: "baseline" | "residual"
      change_request_status:
        | "draft"
        | "pending_owner"
        | "pending_ims"
        | "approved"
        | "rejected"
      department_status: "active" | "inactive"
      document_status: "active" | "retired"
      evidence_type:
        | "document"
        | "link"
        | "screenshot"
        | "report"
        | "ticket"
        | "other"
      kpi_status: "active" | "retired"
      notification_type:
        | "change_request_awaiting_owner"
        | "change_request_awaiting_ims"
        | "change_request_returned"
        | "change_request_published"
      objective_status: "active" | "achieved" | "retired"
      period_status: "open" | "closed"
      period_type: "monthly" | "quarterly" | "semi_annual" | "annual"
      process_status: "active" | "inactive"
      profile_status: "active" | "inactive"
      risk_status: "open" | "treated" | "closed" | "retired"
      target_direction: "higher_is_better" | "lower_is_better" | "exact"
      treatment_effectiveness: "maintain" | "correction" | "corrective_action"
      treatment_status: "planned" | "in_progress" | "completed" | "cancelled"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      action_source: [
        "risk",
        "risk_treatment",
        "risk_treatment_review",
        "kpi",
        "kpi_measurement",
        "objective",
        "objective_measurement",
        "document_change",
        "other",
        "action",
      ],
      action_status: [
        "open",
        "in_progress",
        "blocked",
        "completed",
        "cancelled",
      ],
      activity_status: ["not_started", "in_progress", "completed", "cancelled"],
      aggregation_method: ["average", "sum", "min", "max", "latest"],
      approval_decision: ["approved", "rejected"],
      approval_stage: ["owner", "ims"],
      assessment_type: ["baseline", "residual"],
      change_request_status: [
        "draft",
        "pending_owner",
        "pending_ims",
        "approved",
        "rejected",
      ],
      department_status: ["active", "inactive"],
      document_status: ["active", "retired"],
      evidence_type: [
        "document",
        "link",
        "screenshot",
        "report",
        "ticket",
        "other",
      ],
      kpi_status: ["active", "retired"],
      notification_type: [
        "change_request_awaiting_owner",
        "change_request_awaiting_ims",
        "change_request_returned",
        "change_request_published",
      ],
      objective_status: ["active", "achieved", "retired"],
      period_status: ["open", "closed"],
      period_type: ["monthly", "quarterly", "semi_annual", "annual"],
      process_status: ["active", "inactive"],
      profile_status: ["active", "inactive"],
      risk_status: ["open", "treated", "closed", "retired"],
      target_direction: ["higher_is_better", "lower_is_better", "exact"],
      treatment_effectiveness: ["maintain", "correction", "corrective_action"],
      treatment_status: ["planned", "in_progress", "completed", "cancelled"],
    },
  },
} as const
