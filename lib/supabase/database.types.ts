export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      admin_audit_logs: {
        Row: {
          action: string
          admin_user_id: string | null
          created_at: string
          details: Json
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_insight_preferences: {
        Row: {
          consent_version: string | null
          consented_at: string | null
          enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          consent_version?: string | null
          consented_at?: string | null
          enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          consent_version?: string | null
          consented_at?: string | null
          enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_insight_snapshots: {
        Row: {
          data_coverage: number
          data_fingerprint: string
          generated_at: string
          id: string
          model: string
          report: Json
          user_id: string
        }
        Insert: {
          data_coverage?: number
          data_fingerprint: string
          generated_at?: string
          id?: string
          model: string
          report: Json
          user_id: string
        }
        Update: {
          data_coverage?: number
          data_fingerprint?: string
          generated_at?: string
          id?: string
          model?: string
          report?: Json
          user_id?: string
        }
        Relationships: []
      }
      automatic_payment_runs: {
        Row: {
          amount: number
          amount_eur: number
          created_at: string
          currency: string
          debt_payment_id: string | null
          error_message: string | null
          id: string
          occurrence_key: string
          processed_at: string
          scheduled_for: string
          source_id: string
          source_type: string
          status: string
          transaction_id: string | null
          trigger_mode: string
          user_id: string
        }
        Insert: {
          amount: number
          amount_eur: number
          created_at?: string
          currency: string
          debt_payment_id?: string | null
          error_message?: string | null
          id?: string
          occurrence_key: string
          processed_at?: string
          scheduled_for: string
          source_id: string
          source_type: string
          status: string
          transaction_id?: string | null
          trigger_mode: string
          user_id: string
        }
        Update: {
          amount?: number
          amount_eur?: number
          created_at?: string
          currency?: string
          debt_payment_id?: string | null
          error_message?: string | null
          id?: string
          occurrence_key?: string
          processed_at?: string
          scheduled_for?: string
          source_id?: string
          source_type?: string
          status?: string
          transaction_id?: string | null
          trigger_mode?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automatic_payment_runs_debt_payment_id_fkey"
            columns: ["debt_payment_id"]
            isOneToOne: false
            referencedRelation: "debt_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automatic_payment_runs_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount: number
          amount_eur: number
          autopay: boolean
          autopay_enabled_at: string | null
          autopay_record_time: string
          autopay_timezone: string
          category: string
          company: string | null
          created_at: string
          currency: string
          due_date: string
          exchange_rate_to_eur: number
          id: string
          name: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          recurrence: string
          recurrence_anchor_day: number | null
          recurrence_anchor_month_end: boolean
          reminder_days: number
          status: string
          transaction_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          amount_eur: number
          autopay?: boolean
          autopay_enabled_at?: string | null
          autopay_record_time?: string
          autopay_timezone?: string
          category: string
          company?: string | null
          created_at?: string
          currency?: string
          due_date: string
          exchange_rate_to_eur?: number
          id?: string
          name: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          recurrence?: string
          recurrence_anchor_day?: number | null
          recurrence_anchor_month_end?: boolean
          reminder_days?: number
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          amount_eur?: number
          autopay?: boolean
          autopay_enabled_at?: string | null
          autopay_record_time?: string
          autopay_timezone?: string
          category?: string
          company?: string | null
          created_at?: string
          currency?: string
          due_date?: string
          exchange_rate_to_eur?: number
          id?: string
          name?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          recurrence?: string
          recurrence_anchor_day?: number | null
          recurrence_anchor_month_end?: boolean
          reminder_days?: number
          status?: string
          transaction_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      business_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string
          business_id: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          occurred_at: string
          summary: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string
          business_id: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          summary: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string
          business_id?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_audit_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_cost_budgets: {
        Row: {
          amount_base: number
          budget_month: string
          business_id: string
          category_id: string
          created_at: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          amount_base: number
          budget_month: string
          business_id: string
          category_id: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          amount_base?: number
          budget_month?: string
          business_id?: string
          category_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_cost_budgets_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_cost_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "business_cost_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      business_cost_categories: {
        Row: {
          business_id: string
          created_at: string
          default_nature: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          default_nature?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          default_nature?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_cost_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_cost_centres: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_cost_centres_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_documents: {
        Row: {
          business_id: string
          category: string
          created_at: string
          description: string | null
          expires_on: string | null
          file_path: string
          file_size: number
          id: string
          mime_type: string
          original_filename: string
          title: string
          updated_at: string
          uploaded_by: string
        }
        Insert: {
          business_id: string
          category: string
          created_at?: string
          description?: string | null
          expires_on?: string | null
          file_path: string
          file_size: number
          id?: string
          mime_type: string
          original_filename: string
          title: string
          updated_at?: string
          uploaded_by: string
        }
        Update: {
          business_id?: string
          category?: string
          created_at?: string
          description?: string | null
          expires_on?: string | null
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          original_filename?: string
          title?: string
          updated_at?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_documents_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_inventory_categories: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_inventory_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_inventory_items: {
        Row: {
          barcode: string | null
          business_id: string
          category_id: string | null
          created_at: string
          created_by: string
          default_exchange_rate_to_base: number
          default_purchase_cost: number
          default_purchase_cost_base: number
          default_purchase_currency: string
          id: string
          location_id: string | null
          low_stock_threshold: number
          name: string
          notes: string | null
          selling_price_base: number
          sku: string
          status: string
          supplier_id: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          business_id: string
          category_id?: string | null
          created_at?: string
          created_by: string
          default_exchange_rate_to_base?: number
          default_purchase_cost?: number
          default_purchase_cost_base?: number
          default_purchase_currency?: string
          id?: string
          location_id?: string | null
          low_stock_threshold?: number
          name: string
          notes?: string | null
          selling_price_base?: number
          sku: string
          status?: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          business_id?: string
          category_id?: string | null
          created_at?: string
          created_by?: string
          default_exchange_rate_to_base?: number
          default_purchase_cost?: number
          default_purchase_cost_base?: number
          default_purchase_currency?: string
          id?: string
          location_id?: string | null
          low_stock_threshold?: number
          name?: string
          notes?: string | null
          selling_price_base?: number
          sku?: string
          status?: string
          supplier_id?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_inventory_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_inventory_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "business_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      business_inventory_locations: {
        Row: {
          business_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_inventory_locations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_inventory_movements: {
        Row: {
          business_id: string
          created_at: string
          created_by: string
          currency: string
          exchange_rate_date: string | null
          exchange_rate_source: string | null
          exchange_rate_to_base: number
          id: string
          inventory_value_delta_base: number
          item_id: string
          item_name: string
          item_sku: string
          movement_date: string
          movement_type: string
          notes: string | null
          occurred_at: string
          quantity_delta: number
          reference: string | null
          reversal_of_id: string | null
          supplier_id: string | null
          supplier_name: string | null
          transaction_id: string | null
          unit_cost: number
          unit_cost_base: number
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by: string
          currency?: string
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_base?: number
          id?: string
          inventory_value_delta_base: number
          item_id: string
          item_name: string
          item_sku: string
          movement_date: string
          movement_type: string
          notes?: string | null
          occurred_at: string
          quantity_delta: number
          reference?: string | null
          reversal_of_id?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          transaction_id?: string | null
          unit_cost?: number
          unit_cost_base?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string
          currency?: string
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_base?: number
          id?: string
          inventory_value_delta_base?: number
          item_id?: string
          item_name?: string
          item_sku?: string
          movement_date?: string
          movement_type?: string
          notes?: string | null
          occurred_at?: string
          quantity_delta?: number
          reference?: string | null
          reversal_of_id?: string | null
          supplier_id?: string | null
          supplier_name?: string | null
          transaction_id?: string | null
          unit_cost?: number
          unit_cost_base?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_inventory_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_item_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_inventory_movements_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_inventory_movements_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "business_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_inventory_movements_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "business_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_recurring_costs: {
        Row: {
          amount: number
          amount_base: number
          business_id: string
          category_id: string | null
          category_name: string
          cost_centre_id: string | null
          cost_nature: string
          created_at: string
          created_by: string
          currency: string
          due_day: number
          end_date: string | null
          exchange_rate_date: string | null
          exchange_rate_source: string | null
          exchange_rate_to_base: number
          id: string
          last_error: string | null
          last_recorded_at: string | null
          name: string
          next_run_at: string | null
          notes: string | null
          payment_method: string | null
          record_time: string
          reference: string | null
          start_date: string
          status: string
          supplier: string | null
          supplier_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_base: number
          business_id: string
          category_id?: string | null
          category_name: string
          cost_centre_id?: string | null
          cost_nature?: string
          created_at?: string
          created_by: string
          currency?: string
          due_day: number
          end_date?: string | null
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_base?: number
          id?: string
          last_error?: string | null
          last_recorded_at?: string | null
          name: string
          next_run_at?: string | null
          notes?: string | null
          payment_method?: string | null
          record_time?: string
          reference?: string | null
          start_date?: string
          status?: string
          supplier?: string | null
          supplier_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_base?: number
          business_id?: string
          category_id?: string | null
          category_name?: string
          cost_centre_id?: string | null
          cost_nature?: string
          created_at?: string
          created_by?: string
          currency?: string
          due_day?: number
          end_date?: string | null
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_base?: number
          id?: string
          last_error?: string | null
          last_recorded_at?: string | null
          name?: string
          next_run_at?: string | null
          notes?: string | null
          payment_method?: string | null
          record_time?: string
          reference?: string | null
          start_date?: string
          status?: string
          supplier?: string | null
          supplier_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_recurring_costs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_recurring_costs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "business_cost_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_recurring_costs_cost_centre_id_fkey"
            columns: ["cost_centre_id"]
            isOneToOne: false
            referencedRelation: "business_cost_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_recurring_costs_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "business_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      business_sale_lines: {
        Row: {
          business_id: string
          cogs_base: number
          created_at: string
          gross_profit_base: number
          id: string
          inventory_item_id: string | null
          inventory_movement_id: string | null
          item_name: string
          item_sku: string | null
          line_subtotal: number
          line_subtotal_base: number
          quantity: number
          sale_id: string
          unit_cost_base: number
          unit_price: number
        }
        Insert: {
          business_id: string
          cogs_base?: number
          created_at?: string
          gross_profit_base: number
          id?: string
          inventory_item_id?: string | null
          inventory_movement_id?: string | null
          item_name: string
          item_sku?: string | null
          line_subtotal: number
          line_subtotal_base: number
          quantity: number
          sale_id: string
          unit_cost_base?: number
          unit_price: number
        }
        Update: {
          business_id?: string
          cogs_base?: number
          created_at?: string
          gross_profit_base?: number
          id?: string
          inventory_item_id?: string | null
          inventory_movement_id?: string | null
          item_name?: string
          item_sku?: string | null
          line_subtotal?: number
          line_subtotal_base?: number
          quantity?: number
          sale_id?: string
          unit_cost_base?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_sale_lines_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_sale_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_item_balances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_sale_lines_inventory_item_id_fkey"
            columns: ["inventory_item_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_sale_lines_inventory_movement_id_fkey"
            columns: ["inventory_movement_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_sale_lines_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "business_sales"
            referencedColumns: ["id"]
          },
        ]
      }
      business_sales: {
        Row: {
          business_id: string
          cogs_base: number
          completed_at: string
          created_at: string
          created_by: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          deleted_at: string | null
          discount: number
          discount_base: number
          exchange_rate_date: string | null
          exchange_rate_source: string | null
          exchange_rate_to_base: number
          gross_profit_base: number
          id: string
          line_count: number
          net_sales_base: number
          notes: string | null
          occurred_at: string
          payment_method: string | null
          reference: string | null
          refunded_at: string | null
          sale_date: string
          sale_number: string
          status: string
          subtotal: number
          subtotal_base: number
          tax: number
          tax_base: number
          total: number
          total_base: number
          transaction_id: string | null
          units_sold: number
          updated_at: string
        }
        Insert: {
          business_id: string
          cogs_base?: number
          completed_at?: string
          created_at?: string
          created_by: string
          currency: string
          customer_email?: string | null
          customer_name?: string | null
          deleted_at?: string | null
          discount?: number
          discount_base?: number
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_base?: number
          gross_profit_base: number
          id?: string
          line_count?: number
          net_sales_base: number
          notes?: string | null
          occurred_at: string
          payment_method?: string | null
          reference?: string | null
          refunded_at?: string | null
          sale_date: string
          sale_number: string
          status?: string
          subtotal: number
          subtotal_base: number
          tax?: number
          tax_base?: number
          total: number
          total_base: number
          transaction_id?: string | null
          units_sold?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          cogs_base?: number
          completed_at?: string
          created_at?: string
          created_by?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          deleted_at?: string | null
          discount?: number
          discount_base?: number
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_base?: number
          gross_profit_base?: number
          id?: string
          line_count?: number
          net_sales_base?: number
          notes?: string | null
          occurred_at?: string
          payment_method?: string | null
          reference?: string | null
          refunded_at?: string | null
          sale_date?: string
          sale_number?: string
          status?: string
          subtotal?: number
          subtotal_base?: number
          tax?: number
          tax_base?: number
          total?: number
          total_base?: number
          transaction_id?: string | null
          units_sold?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_sales_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "business_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          business_id: string
          created_at: string
          date_format: string
          default_low_stock_threshold: number
          default_payment_method: string
          default_payment_terms_days: number
          default_sales_tax_rate: number
          default_timezone: string
          invoice_prefix: string
          next_invoice_number: number
          number_format: string
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          date_format?: string
          default_low_stock_threshold?: number
          default_payment_method?: string
          default_payment_terms_days?: number
          default_sales_tax_rate?: number
          default_timezone?: string
          invoice_prefix?: string
          next_invoice_number?: number
          number_format?: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          date_format?: string
          default_low_stock_threshold?: number
          default_payment_method?: string
          default_payment_terms_days?: number
          default_sales_tax_rate?: number
          default_timezone?: string
          invoice_prefix?: string
          next_invoice_number?: number
          number_format?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_supplier_invoices: {
        Row: {
          amount: number
          amount_base: number
          business_id: string
          category_id: string | null
          category_name: string
          cost_centre_id: string | null
          cost_nature: string
          created_at: string
          created_by: string
          currency: string
          description: string
          due_date: string
          exchange_rate_date: string | null
          exchange_rate_source: string | null
          exchange_rate_to_base: number
          id: string
          invoice_number: string
          issue_date: string
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          status: string
          supplier_id: string
          transaction_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          amount_base: number
          business_id: string
          category_id?: string | null
          category_name: string
          cost_centre_id?: string | null
          cost_nature: string
          created_at?: string
          created_by: string
          currency: string
          description: string
          due_date: string
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_base?: number
          id?: string
          invoice_number: string
          issue_date: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          supplier_id: string
          transaction_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_base?: number
          business_id?: string
          category_id?: string | null
          category_name?: string
          cost_centre_id?: string | null
          cost_nature?: string
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          due_date?: string
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_base?: number
          id?: string
          invoice_number?: string
          issue_date?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          status?: string
          supplier_id?: string
          transaction_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_supplier_invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_supplier_invoices_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "business_cost_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_supplier_invoices_cost_centre_id_fkey"
            columns: ["cost_centre_id"]
            isOneToOne: false
            referencedRelation: "business_cost_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_supplier_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "business_suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_supplier_invoices_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "business_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      business_suppliers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          business_id: string
          category: string
          city: string | null
          contact_name: string | null
          country_code: string | null
          created_at: string
          created_by: string
          default_currency: string
          email: string | null
          id: string
          legal_name: string | null
          name: string
          notes: string | null
          payment_terms_days: number
          phone: string | null
          postal_code: string | null
          status: string
          supplier_code: string | null
          tax_id: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          business_id: string
          category?: string
          city?: string | null
          contact_name?: string | null
          country_code?: string | null
          created_at?: string
          created_by: string
          default_currency?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          name: string
          notes?: string | null
          payment_terms_days?: number
          phone?: string | null
          postal_code?: string | null
          status?: string
          supplier_code?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          business_id?: string
          category?: string
          city?: string | null
          contact_name?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string
          default_currency?: string
          email?: string | null
          id?: string
          legal_name?: string | null
          name?: string
          notes?: string | null
          payment_terms_days?: number
          phone?: string | null
          postal_code?: string | null
          status?: string
          supplier_code?: string | null
          tax_id?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_suppliers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_transactions: {
        Row: {
          amount: number
          amount_base: number
          business_id: string
          category: string
          cost_category_id: string | null
          cost_centre_id: string | null
          cost_nature: string | null
          counterparty: string | null
          created_at: string
          created_by: string
          currency: string
          description: string
          exchange_rate_date: string | null
          exchange_rate_source: string | null
          exchange_rate_to_base: number
          id: string
          notes: string | null
          occurred_at: string
          payment_method: string | null
          recurrence_key: string | null
          reference: string | null
          source_inventory_movement_id: string | null
          source_recurring_cost_id: string | null
          source_sale_id: string | null
          source_supplier_invoice_id: string | null
          supplier_id: string | null
          transaction_date: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_base: number
          business_id: string
          category: string
          cost_category_id?: string | null
          cost_centre_id?: string | null
          cost_nature?: string | null
          counterparty?: string | null
          created_at?: string
          created_by: string
          currency?: string
          description: string
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_base?: number
          id?: string
          notes?: string | null
          occurred_at: string
          payment_method?: string | null
          recurrence_key?: string | null
          reference?: string | null
          source_inventory_movement_id?: string | null
          source_recurring_cost_id?: string | null
          source_sale_id?: string | null
          source_supplier_invoice_id?: string | null
          supplier_id?: string | null
          transaction_date: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_base?: number
          business_id?: string
          category?: string
          cost_category_id?: string | null
          cost_centre_id?: string | null
          cost_nature?: string | null
          counterparty?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_base?: number
          id?: string
          notes?: string | null
          occurred_at?: string
          payment_method?: string | null
          recurrence_key?: string | null
          reference?: string | null
          source_inventory_movement_id?: string | null
          source_recurring_cost_id?: string | null
          source_sale_id?: string | null
          source_supplier_invoice_id?: string | null
          supplier_id?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_transactions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_transactions_cost_category_id_fkey"
            columns: ["cost_category_id"]
            isOneToOne: false
            referencedRelation: "business_cost_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_transactions_cost_centre_id_fkey"
            columns: ["cost_centre_id"]
            isOneToOne: false
            referencedRelation: "business_cost_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_transactions_source_inventory_movement_id_fkey"
            columns: ["source_inventory_movement_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_movements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_transactions_source_recurring_cost_id_fkey"
            columns: ["source_recurring_cost_id"]
            isOneToOne: false
            referencedRelation: "business_recurring_costs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_transactions_source_sale_id_fkey"
            columns: ["source_sale_id"]
            isOneToOne: false
            referencedRelation: "business_sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_transactions_source_supplier_invoice_id_fkey"
            columns: ["source_supplier_invoice_id"]
            isOneToOne: false
            referencedRelation: "business_supplier_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "business_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      business_user_preferences: {
        Row: {
          active_business_id: string | null
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_business_id?: string | null
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_business_id?: string | null
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_user_preferences_active_business_id_fkey"
            columns: ["active_business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          archived_at: string | null
          base_currency: string
          business_type: string
          city: string | null
          contact_email: string | null
          contact_phone: string | null
          country_code: string
          cover_image_path: string | null
          created_at: string
          fiscal_year_start_month: number
          id: string
          legal_name: string | null
          logo_path: string | null
          name: string
          owner_id: string
          postal_code: string | null
          status: string
          tax_id: string | null
          timezone: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          base_currency?: string
          business_type?: string
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string
          cover_image_path?: string | null
          created_at?: string
          fiscal_year_start_month?: number
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          name: string
          owner_id: string
          postal_code?: string | null
          status?: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          archived_at?: string | null
          base_currency?: string
          business_type?: string
          city?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          country_code?: string
          cover_image_path?: string | null
          created_at?: string
          fiscal_year_start_month?: number
          id?: string
          legal_name?: string | null
          logo_path?: string | null
          name?: string
          owner_id?: string
          postal_code?: string | null
          status?: string
          tax_id?: string | null
          timezone?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      credit_card_activities: {
        Row: {
          activity_type: string
          amount: number
          amount_eur: number
          balance_effect: number
          balance_effect_eur: number
          created_at: string
          currency: string
          debt_id: string
          description: string
          exchange_rate_to_eur: number
          id: string
          notes: string | null
          occurred_at: string
          user_id: string
        }
        Insert: {
          activity_type: string
          amount: number
          amount_eur: number
          balance_effect: number
          balance_effect_eur: number
          created_at?: string
          currency: string
          debt_id: string
          description: string
          exchange_rate_to_eur: number
          id?: string
          notes?: string | null
          occurred_at: string
          user_id: string
        }
        Update: {
          activity_type?: string
          amount?: number
          amount_eur?: number
          balance_effect?: number
          balance_effect_eur?: number
          created_at?: string
          currency?: string
          debt_id?: string
          description?: string
          exchange_rate_to_eur?: number
          id?: string
          notes?: string | null
          occurred_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_activities_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_card_monthly_records: {
        Row: {
          created_at: string
          currency: string
          debt_id: string
          id: string
          interest_charged: number
          interest_charged_eur: number
          minimum_payment: number
          minimum_payment_eur: number
          month_start: string
          payment_due_date: string
          statement_balance: number
          statement_balance_eur: number
          statement_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency: string
          debt_id: string
          id?: string
          interest_charged?: number
          interest_charged_eur?: number
          minimum_payment: number
          minimum_payment_eur: number
          month_start: string
          payment_due_date: string
          statement_balance: number
          statement_balance_eur: number
          statement_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          debt_id?: string
          id?: string
          interest_charged?: number
          interest_charged_eur?: number
          minimum_payment?: number
          minimum_payment_eur?: number
          month_start?: string
          payment_due_date?: string
          statement_balance?: number
          statement_balance_eur?: number
          statement_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_card_monthly_records_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payments: {
        Row: {
          amount: number
          amount_eur: number
          created_at: string
          currency: string
          debt_id: string
          exchange_rate_to_eur: number
          id: string
          notes: string | null
          paid_at: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          amount_eur: number
          created_at?: string
          currency: string
          debt_id: string
          exchange_rate_to_eur: number
          id?: string
          notes?: string | null
          paid_at: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          amount_eur?: number
          created_at?: string
          currency?: string
          debt_id?: string
          exchange_rate_to_eur?: number
          id?: string
          notes?: string | null
          paid_at?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          annual_interest_rate: number
          autopay: boolean
          autopay_enabled_at: string | null
          autopay_record_time: string
          autopay_timezone: string
          card_last_four: string | null
          category: string
          created_at: string
          credit_limit: number | null
          credit_limit_eur: number | null
          currency: string
          current_balance: number
          current_balance_eur: number
          description: string | null
          exchange_rate_to_eur: number
          id: string
          interest_charged: number
          interest_charged_eur: number
          lender: string | null
          maturity_date: string | null
          minimum_payment: number
          minimum_payment_eur: number
          name: string
          original_balance: number
          original_balance_eur: number
          payment_due_date: string | null
          payment_due_day: number | null
          start_date: string | null
          statement_balance: number | null
          statement_balance_eur: number | null
          statement_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_interest_rate?: number
          autopay?: boolean
          autopay_enabled_at?: string | null
          autopay_record_time?: string
          autopay_timezone?: string
          card_last_four?: string | null
          category: string
          created_at?: string
          credit_limit?: number | null
          credit_limit_eur?: number | null
          currency?: string
          current_balance: number
          current_balance_eur: number
          description?: string | null
          exchange_rate_to_eur?: number
          id?: string
          interest_charged?: number
          interest_charged_eur?: number
          lender?: string | null
          maturity_date?: string | null
          minimum_payment?: number
          minimum_payment_eur?: number
          name: string
          original_balance: number
          original_balance_eur: number
          payment_due_date?: string | null
          payment_due_day?: number | null
          start_date?: string | null
          statement_balance?: number | null
          statement_balance_eur?: number | null
          statement_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_interest_rate?: number
          autopay?: boolean
          autopay_enabled_at?: string | null
          autopay_record_time?: string
          autopay_timezone?: string
          card_last_four?: string | null
          category?: string
          created_at?: string
          credit_limit?: number | null
          credit_limit_eur?: number | null
          currency?: string
          current_balance?: number
          current_balance_eur?: number
          description?: string | null
          exchange_rate_to_eur?: number
          id?: string
          interest_charged?: number
          interest_charged_eur?: number
          lender?: string | null
          maturity_date?: string | null
          minimum_payment?: number
          minimum_payment_eur?: number
          name?: string
          original_balance?: number
          original_balance_eur?: number
          payment_due_date?: string | null
          payment_due_day?: number | null
          start_date?: string | null
          statement_balance?: number | null
          statement_balance_eur?: number | null
          statement_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      document_upload_intents: {
        Row: {
          category: string
          created_at: string
          display_name: string
          document_date: string | null
          expires_at: string
          id: string
          mime_type: string
          notes: string | null
          original_name: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          display_name: string
          document_date?: string | null
          expires_at?: string
          id?: string
          mime_type: string
          notes?: string | null
          original_name: string
          size_bytes: number
          storage_path: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          display_name?: string
          document_date?: string | null
          expires_at?: string
          id?: string
          mime_type?: string
          notes?: string | null
          original_name?: string
          size_bytes?: number
          storage_path?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_documents: {
        Row: {
          category: string
          created_at: string
          display_name: string
          document_date: string | null
          id: string
          mime_type: string
          notes: string | null
          original_name: string
          size_bytes: number
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          display_name: string
          document_date?: string | null
          id?: string
          mime_type: string
          notes?: string | null
          original_name: string
          size_bytes: number
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          display_name?: string
          document_date?: string | null
          id?: string
          mime_type?: string
          notes?: string | null
          original_name?: string
          size_bytes?: number
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_independence_settings: {
        Row: {
          annual_real_return_rate: number
          target_monthly_spending: number | null
          updated_at: string
          user_id: string
          withdrawal_rate: number
        }
        Insert: {
          annual_real_return_rate?: number
          target_monthly_spending?: number | null
          updated_at?: string
          user_id: string
          withdrawal_rate?: number
        }
        Update: {
          annual_real_return_rate?: number
          target_monthly_spending?: number | null
          updated_at?: string
          user_id?: string
          withdrawal_rate?: number
        }
        Relationships: []
      }
      goal_investments: {
        Row: {
          amount: number
          created_at: string
          goal_id: string
          id: string
          invested_at: string
          notes: string | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          goal_id: string
          id?: string
          invested_at: string
          notes?: string | null
          transaction_id: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          goal_id?: string
          id?: string
          invested_at?: string
          notes?: string | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_investments_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_investments_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: true
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          current_amount: number
          id: string
          name: string
          status: string
          target_amount: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_amount?: number
          id?: string
          name: string
          status?: string
          target_amount: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_amount?: number
          id?: string
          name?: string
          status?: string
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      money_entry_preferences: {
        Row: {
          created_at: string
          entry_mode: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_mode?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_mode?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_budget_items: {
        Row: {
          created_at: string
          id: string
          label: string
          month: string
          planned_amount: number
          position: number
          section: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          month: string
          planned_amount: number
          position?: number
          section: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          month?: string
          planned_amount?: number
          position?: number
          section?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monthly_budget_plans: {
        Row: {
          created_at: string
          id: string
          month: string
          start_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          start_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          start_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_usage_daily: {
        Row: {
          active_seconds: number
          first_seen_at: string
          last_seen_at: string
          sessions_count: number
          updated_at: string
          usage_date: string
          user_id: string
          workspace: string
        }
        Insert: {
          active_seconds?: number
          first_seen_at?: string
          last_seen_at?: string
          sessions_count?: number
          updated_at?: string
          usage_date: string
          user_id: string
          workspace: string
        }
        Update: {
          active_seconds?: number
          first_seen_at?: string
          last_seen_at?: string
          sessions_count?: number
          updated_at?: string
          usage_date?: string
          user_id?: string
          workspace?: string
        }
        Relationships: []
      }
      platform_usage_presence: {
        Row: {
          is_visible: boolean
          last_seen_at: string
          module: string
          session_id: string
          started_at: string
          updated_at: string
          user_id: string
          workspace: string
        }
        Insert: {
          is_visible?: boolean
          last_seen_at?: string
          module: string
          session_id: string
          started_at?: string
          updated_at?: string
          user_id: string
          workspace: string
        }
        Update: {
          is_visible?: boolean
          last_seen_at?: string
          module?: string
          session_id?: string
          started_at?: string
          updated_at?: string
          user_id?: string
          workspace?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          base_currency: string
          base_currency_updated_at: string
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          base_currency?: string
          base_currency_updated_at?: string
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          base_currency?: string
          base_currency_updated_at?: string
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      statement_import_batches: {
        Row: {
          completed_at: string | null
          created_at: string
          file_name: string
          id: string
          imported_count: number
          mapping: Json
          requested_count: number
          skipped_duplicate_count: number
          skipped_invalid_count: number
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          file_name: string
          id?: string
          imported_count?: number
          mapping?: Json
          requested_count?: number
          skipped_duplicate_count?: number
          skipped_invalid_count?: number
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          file_name?: string
          id?: string
          imported_count?: number
          mapping?: Json
          requested_count?: number
          skipped_duplicate_count?: number
          skipped_invalid_count?: number
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      statement_import_items: {
        Row: {
          batch_id: string
          created_at: string
          fingerprint: string
          id: string
          source_data: Json
          source_row_number: number
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          batch_id: string
          created_at?: string
          fingerprint: string
          id?: string
          source_data?: Json
          source_row_number: number
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          batch_id?: string
          created_at?: string
          fingerprint?: string
          id?: string
          source_data?: Json
          source_row_number?: number
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "statement_import_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "statement_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "statement_import_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      statement_import_profiles: {
        Row: {
          created_at: string
          delimiter: string
          id: string
          mapping: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          delimiter?: string
          id?: string
          mapping?: Json
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          delimiter?: string
          id?: string
          mapping?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          internal_note: boolean
          is_initial: boolean
          request_id: string
          sender_role: string
          sender_user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          internal_note?: boolean
          is_initial?: boolean
          request_id: string
          sender_role: string
          sender_user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          internal_note?: boolean
          is_initial?: boolean
          request_id?: string
          sender_role?: string
          sender_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "support_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      support_requests: {
        Row: {
          admin_last_read_at: string | null
          category: string
          contact_email: string
          created_at: string
          customer_last_read_at: string | null
          handled_by: string | null
          id: string
          last_message_at: string
          message: string
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_last_read_at?: string | null
          category: string
          contact_email: string
          created_at?: string
          customer_last_read_at?: string | null
          handled_by?: string | null
          id?: string
          last_message_at?: string
          message: string
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_last_read_at?: string | null
          category?: string
          contact_email?: string
          created_at?: string
          customer_last_read_at?: string | null
          handled_by?: string | null
          id?: string
          last_message_at?: string
          message?: string
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_category_rules: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          match_text: string
          priority: number
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          match_text: string
          priority?: number
          transaction_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          match_text?: string
          priority?: number
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_template_postings: {
        Row: {
          created_at: string
          id: string
          period_key: string
          template_id: string
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          period_key: string
          template_id: string
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          period_key?: string
          template_id?: string
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_template_postings_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "transaction_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_template_postings_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_templates: {
        Row: {
          amount: number
          amount_eur: number | null
          category: string
          created_at: string
          currency: string
          day_of_month: number | null
          description: string
          exchange_rate_date: string | null
          exchange_rate_source: string | null
          exchange_rate_to_eur: number | null
          id: string
          is_active: boolean
          is_favorite: boolean
          is_recurring: boolean
          label: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          amount_eur?: number | null
          category: string
          created_at?: string
          currency?: string
          day_of_month?: number | null
          description: string
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_eur?: number | null
          id?: string
          is_active?: boolean
          is_favorite?: boolean
          is_recurring?: boolean
          label: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          amount_eur?: number | null
          category?: string
          created_at?: string
          currency?: string
          day_of_month?: number | null
          description?: string
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_eur?: number | null
          id?: string
          is_active?: boolean
          is_favorite?: boolean
          is_recurring?: boolean
          label?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          amount_eur: number
          category: string
          created_at: string
          currency: string
          description: string
          exchange_rate_date: string | null
          exchange_rate_source: string | null
          exchange_rate_to_eur: number
          id: string
          occurred_at: string
          transaction_date: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          amount_eur: number
          category: string
          created_at?: string
          currency?: string
          description: string
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_eur: number
          id?: string
          occurred_at: string
          transaction_date: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          amount_eur?: number
          category?: string
          created_at?: string
          currency?: string
          description?: string
          exchange_rate_date?: string | null
          exchange_rate_source?: string | null
          exchange_rate_to_eur?: number
          id?: string
          occurred_at?: string
          transaction_date?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string
          href: string | null
          id: string
          kind: string
          metadata: Json
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          href?: string | null
          id?: string
          kind: string
          metadata?: Json
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          href?: string | null
          id?: string
          kind?: string
          metadata?: Json
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      business_inventory_item_balances: {
        Row: {
          average_cost_base: number | null
          barcode: string | null
          business_id: string | null
          category_id: string | null
          category_name: string | null
          created_at: string | null
          created_by: string | null
          default_exchange_rate_to_base: number | null
          default_purchase_cost: number | null
          default_purchase_cost_base: number | null
          default_purchase_currency: string | null
          id: string | null
          inventory_value_base: number | null
          last_movement_at: string | null
          location_id: string | null
          location_name: string | null
          low_stock_threshold: number | null
          movement_count: number | null
          name: string | null
          notes: string | null
          potential_gross_profit_base: number | null
          potential_sales_value_base: number | null
          quantity_on_hand: number | null
          selling_price_base: number | null
          sku: string | null
          status: string | null
          supplier_id: string | null
          supplier_name: string | null
          unit: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_inventory_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_inventory_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "business_inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_inventory_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "business_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_account_directory: {
        Args: never
        Returns: {
          banned_until: string
          created_at: string
          display_name: string
          email: string
          last_sign_in_at: string
          role: string
          user_id: string
        }[]
      }
      admin_platform_overview: { Args: never; Returns: Json }
      admin_safe_relation_count: {
        Args: { relation_name: string }
        Returns: number
      }
      admin_usage_directory: {
        Args: { p_scope?: string }
        Returns: {
          account_created_at: string
          account_status: string
          business_count: number
          business_names: string[]
          current_module: string
          current_workspace: string
          email: string
          first_business_created_at: string
          is_live: boolean
          last_active_at: string
          owned_business_count: number
          roles: string[]
          sessions_today: number
          time_used_today_seconds: number
          user_id: string
          user_name: string
        }[]
      }
      admin_usage_overview: { Args: { p_scope?: string }; Returns: Json }
      archive_business_workspace: {
        Args: { p_business_id: string }
        Returns: Json
      }
      business_member_can_manage: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      business_member_can_write: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      business_member_has_access: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      business_next_recurring_timestamp: {
        Args: {
          p_after: string
          p_due_day: number
          p_record_time: string
          p_start_date: string
          p_timezone: string
        }
        Returns: string
      }
      business_scheduled_timestamp: {
        Args: {
          p_due_day: number
          p_month: string
          p_record_time: string
          p_timezone: string
        }
        Returns: string
      }
      business_workspace_has_financial_activity: {
        Args: { p_business_id: string }
        Returns: boolean
      }
      create_business_document: {
        Args: {
          p_business_id: string
          p_category: string
          p_description: string
          p_document_id: string
          p_expires_on: string
          p_file_path: string
          p_file_size: number
          p_mime_type: string
          p_original_filename: string
          p_title: string
        }
        Returns: Json
      }
      create_business_inventory_item: {
        Args: {
          p_barcode?: string
          p_business_id: string
          p_category_id?: string
          p_default_exchange_rate_to_base?: number
          p_default_purchase_cost?: number
          p_default_purchase_cost_base?: number
          p_default_purchase_currency?: string
          p_location_id?: string
          p_low_stock_threshold?: number
          p_name: string
          p_notes?: string
          p_opening_quantity?: number
          p_selling_price_base?: number
          p_sku: string
          p_supplier_id?: string
          p_unit?: string
        }
        Returns: Json
      }
      create_business_workspace: {
        Args: {
          p_base_currency?: string
          p_business_type?: string
          p_country_code?: string
          p_fiscal_year_start_month?: number
          p_legal_name?: string
          p_name: string
          p_timezone?: string
        }
        Returns: string
      }
      delete_all_financial_records: { Args: never; Returns: Json }
      delete_bill_with_transaction: {
        Args: { p_bill_id: string }
        Returns: Json
      }
      delete_business_document: {
        Args: { p_document_id: string }
        Returns: Json
      }
      delete_business_sale: { Args: { p_sale_id: string }; Returns: Json }
      delete_business_workspace: {
        Args: { p_business_id: string; p_confirmation_name: string }
        Returns: Json
      }
      delete_debt_with_linked_transactions: {
        Args: { p_debt_id: string }
        Returns: Json
      }
      delete_debt_with_payments: { Args: { p_debt_id: string }; Returns: Json }
      delete_goal_with_investments: {
        Args: { p_goal_id: string }
        Returns: Json
      }
      delete_transactions_with_linked_bills: {
        Args: { p_transaction_ids: string[] }
        Returns: Json
      }
      ficonter_debt_due_date: {
        Args: { p_due_day: number; p_reference_date: string }
        Returns: string
      }
      ficonter_next_bill_due_date: {
        Args: {
          p_anchor_day: number
          p_anchor_month_end: boolean
          p_due_date: string
          p_recurrence: string
        }
        Returns: string
      }
      ficonter_record_bill_occurrence: {
        Args: {
          p_bill_id: string
          p_occurred_at: string
          p_occurrence_date: string
          p_transaction_date: string
          p_trigger_mode: string
          p_user_id: string
        }
        Returns: Json
      }
      ficonter_record_debt_occurrence: {
        Args: {
          p_debt_id: string
          p_occurred_at: string
          p_occurrence_key: string
          p_transaction_date: string
          p_trigger_mode: string
          p_user_id: string
        }
        Returns: Json
      }
      ficonter_safe_timezone: { Args: { p_timezone: string }; Returns: string }
      ficonter_scheduled_timestamp: {
        Args: { p_date: string; p_time: string; p_timezone: string }
        Returns: string
      }
      get_ai_insights_inputs: { Args: never; Returns: Json }
      get_business_overview: {
        Args: { p_business_id: string; p_month?: string }
        Returns: Json
      }
      get_business_profitability_report: {
        Args: {
          p_business_id: string
          p_end_date: string
          p_start_date: string
        }
        Returns: Json
      }
      get_cash_flow_intelligence_inputs: { Args: never; Returns: Json }
      get_cash_flow_intelligence_inputs_v2: { Args: never; Returns: Json }
      get_cash_flow_intelligence_inputs_v2_base: { Args: never; Returns: Json }
      get_emergency_fund_intelligence_inputs: { Args: never; Returns: Json }
      get_financial_health_inputs: { Args: never; Returns: Json }
      get_financial_independence_inputs: { Args: never; Returns: Json }
      get_net_worth_growth_inputs: { Args: never; Returns: Json }
      get_savings_intelligence_inputs: { Args: never; Returns: Json }
      get_wealth_score_inputs: { Args: never; Returns: Json }
      has_active_document_upload_intent: {
        Args: { p_storage_path: string }
        Returns: boolean
      }
      import_statement_transactions: {
        Args: { p_file_name: string; p_mapping?: Json; p_rows: Json }
        Returns: Json
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_platform_super_admin: { Args: never; Returns: boolean }
      mark_bill_paid: {
        Args: {
          p_bill_id: string
          p_paid_at: string
          p_transaction_date: string
        }
        Returns: Json
      }
      mark_bill_unpaid: {
        Args: { p_bill_id: string }
        Returns: Json
      }
      platform_usage_is_admin: { Args: never; Returns: boolean }
      post_monthly_transaction_template: {
        Args: { p_period_key?: string; p_template_id: string }
        Returns: {
          amount: number
          amount_eur: number
          category: string
          created_at: string
          currency: string
          description: string
          exchange_rate_date: string | null
          exchange_rate_source: string | null
          exchange_rate_to_eur: number
          id: string
          occurred_at: string
          transaction_date: string
          type: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "transactions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      process_automatic_payments: { Args: never; Returns: Json }
      process_business_recurring_costs: { Args: never; Returns: Json }
      record_bill_payment_and_advance: {
        Args: { p_bill_id: string; p_paid_at?: string }
        Returns: Json
      }
      record_business_inventory_movement: {
        Args: {
          p_cost_category_id?: string
          p_cost_centre_id?: string
          p_create_expense?: boolean
          p_currency?: string
          p_exchange_rate_date?: string
          p_exchange_rate_source?: string
          p_exchange_rate_to_base?: number
          p_item_id: string
          p_movement_date?: string
          p_movement_type: string
          p_notes?: string
          p_occurred_at?: string
          p_payment_method?: string
          p_quantity: number
          p_reference?: string
          p_supplier_id?: string
          p_unit_cost?: number
          p_unit_cost_base?: number
        }
        Returns: Json
      }
      record_business_sale: {
        Args: {
          p_business_id: string
          p_currency?: string
          p_customer_email?: string
          p_customer_name?: string
          p_discount?: number
          p_exchange_rate_date?: string
          p_exchange_rate_source?: string
          p_exchange_rate_to_base?: number
          p_lines?: Json
          p_notes?: string
          p_occurred_at?: string
          p_payment_method?: string
          p_reference?: string
          p_sale_date?: string
          p_sale_number: string
          p_tax?: number
        }
        Returns: Json
      }
      record_business_supplier_invoice_payment: {
        Args: {
          p_invoice_id: string
          p_paid_at?: string
          p_payment_method?: string
        }
        Returns: Json
      }
      record_credit_card_activity: {
        Args: {
          p_activity_type: string
          p_amount: number
          p_amount_eur: number
          p_debt_id: string
          p_description: string
          p_exchange_rate: number
          p_notes?: string
          p_occurred_at: string
        }
        Returns: Json
      }
      record_credit_card_payment: {
        Args: {
          p_amount: number
          p_amount_eur: number
          p_debt_id: string
          p_exchange_rate: number
          p_exchange_rate_date: string
          p_notes: string
          p_paid_at: string
        }
        Returns: Json
      }
      record_debt_payment: {
        Args: {
          p_amount: number
          p_amount_eur: number
          p_debt_id: string
          p_exchange_rate: number
          p_notes: string
          p_paid_at: string
          p_transaction_id: string
        }
        Returns: Json
      }
      record_debt_payment_atomic: {
        Args: {
          p_amount: number
          p_amount_eur: number
          p_debt_id: string
          p_exchange_rate: number
          p_exchange_rate_date: string
          p_notes: string
          p_paid_at: string
        }
        Returns: Json
      }
      record_debt_payment_with_transaction: {
        Args: {
          p_amount: number
          p_amount_eur: number
          p_debt_id: string
          p_exchange_rate: number
          p_exchange_rate_date: string
          p_notes: string
          p_paid_at: string
        }
        Returns: Json
      }
      record_goal_investment: {
        Args: {
          p_amount: number
          p_goal_id: string
          p_invested_at: string
          p_notes: string
        }
        Returns: Json
      }
      record_platform_usage_heartbeat: {
        Args: {
          p_module: string
          p_session_id: string
          p_visible?: boolean
          p_workspace: string
        }
        Returns: Json
      }
      refund_business_sale: { Args: { p_sale_id: string }; Returns: Json }
      reserve_document_upload: {
        Args: {
          p_category: string
          p_display_name: string
          p_document_date?: string
          p_mime_type: string
          p_notes?: string
          p_original_name: string
          p_size_bytes: number
          p_storage_path: string
          p_user_id: string
        }
        Returns: string
      }
      restore_business_sale: { Args: { p_sale_id: string }; Returns: Json }
      restore_business_workspace: {
        Args: { p_business_id: string }
        Returns: Json
      }
      reverse_business_inventory_movement: {
        Args: {
          p_movement_id: string
          p_notes?: string
          p_occurred_at?: string
        }
        Returns: Json
      }
      reverse_business_supplier_invoice_payment: {
        Args: { p_invoice_id: string }
        Returns: Json
      }
      reverse_credit_card_activity: {
        Args: { p_activity_id: string }
        Returns: Json
      }
      reverse_debt_payment: { Args: { p_payment_id: string }; Returns: Json }
      reverse_debt_payment_atomic: {
        Args: { p_payment_id: string }
        Returns: Json
      }
      reverse_goal_investment: {
        Args: { p_investment_id: string }
        Returns: Json
      }
      save_credit_card_monthly_record: {
        Args: {
          p_apr: number
          p_debt_id: string
          p_exchange_rate: number
          p_interest_charged: number
          p_interest_charged_eur: number
          p_minimum_payment: number
          p_minimum_payment_eur: number
          p_payment_due_date: string
          p_statement_balance: number
          p_statement_balance_eur: number
          p_statement_date: string
        }
        Returns: Json
      }
      seed_business_cost_control_defaults: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      seed_business_inventory_defaults: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      set_active_business_workspace: {
        Args: { p_business_id: string }
        Returns: string
      }
      update_business_administration_settings: {
        Args: {
          p_business_id: string
          p_date_format: string
          p_default_low_stock_threshold: number
          p_default_payment_method: string
          p_default_payment_terms_days: number
          p_default_sales_tax_rate: number
          p_default_timezone: string
          p_invoice_prefix: string
          p_next_invoice_number: number
          p_number_format: string
        }
        Returns: Json
      }
      update_business_document: {
        Args: {
          p_category: string
          p_description: string
          p_document_id: string
          p_expires_on: string
          p_title: string
        }
        Returns: Json
      }
      update_business_sale: {
        Args: {
          p_currency?: string
          p_customer_email?: string
          p_customer_name?: string
          p_discount?: number
          p_exchange_rate_date?: string
          p_exchange_rate_source?: string
          p_exchange_rate_to_base?: number
          p_lines?: Json
          p_notes?: string
          p_occurred_at?: string
          p_payment_method?: string
          p_reference?: string
          p_sale_date?: string
          p_sale_id: string
          p_sale_number: string
          p_tax?: number
        }
        Returns: Json
      }
      update_business_workspace: {
        Args: {
          p_address_line1: string
          p_address_line2: string
          p_base_currency: string
          p_business_id: string
          p_business_type: string
          p_city: string
          p_contact_email: string
          p_contact_phone: string
          p_country_code: string
          p_cover_image_path: string
          p_fiscal_year_start_month: number
          p_legal_name: string
          p_logo_path: string
          p_name: string
          p_postal_code: string
          p_tax_id: string
          p_timezone: string
          p_website: string
        }
        Returns: Json
      }
      update_credit_card_statement: {
        Args: {
          p_apr: number
          p_debt_id: string
          p_exchange_rate: number
          p_interest_charged: number
          p_interest_charged_eur: number
          p_minimum_payment: number
          p_minimum_payment_eur: number
          p_payment_due_date: string
          p_statement_balance: number
          p_statement_balance_eur: number
          p_statement_date: string
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
    Enums: {},
  },
} as const
