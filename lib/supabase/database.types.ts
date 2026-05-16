/**
 * Hand-maintained schema mirror for migrations 0001–0029.
 * Regenerate from a live project when convenient:
 *   supabase gen types typescript --linked > lib/supabase/database.types.ts
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      customer_identities: {
        Row: {
          id: string;
          auth_user_id: string | null;
          email: string | null;
          first_name: string | null;
          last_name: string | null;
          full_name: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          full_name?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          email?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          full_name?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_log_entries: {
        Row: {
          id: string;
          actor_user_id: string | null;
          action: string;
          target_tenant_id: string | null;
          payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_user_id?: string | null;
          action: string;
          target_tenant_id?: string | null;
          payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_user_id?: string | null;
          action?: string;
          target_tenant_id?: string | null;
          payload?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      customer_support_messages: {
        Row: {
          id: string;
          thread_id: string;
          author_user_id: string | null;
          body: string;
          is_from_customer: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          thread_id: string;
          author_user_id?: string | null;
          body: string;
          is_from_customer?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          thread_id?: string;
          author_user_id?: string | null;
          body?: string;
          is_from_customer?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_support_messages_thread_id_fkey';
            columns: ['thread_id'];
            isOneToOne: false;
            referencedRelation: 'customer_support_threads';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_support_threads: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          subject: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_id: string;
          subject?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          subject?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_support_threads_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_support_threads_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_tenant_links: {
        Row: {
          id: string;
          customer_identity_id: string;
          tenant_id: string;
          customer_id: string;
          is_primary: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_identity_id: string;
          tenant_id: string;
          customer_id: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_identity_id?: string;
          tenant_id?: string;
          customer_id?: string;
          is_primary?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_tenant_links_customer_identity_id_fkey';
            columns: ['customer_identity_id'];
            isOneToOne: false;
            referencedRelation: 'customer_identities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_tenant_links_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_tenant_links_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_portal_invites: {
        Row: {
          token: string;
          tenant_id: string;
          customer_id: string;
          customer_identity_id: string;
          email_normalized: string;
          invited_by_user_id: string | null;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          token?: string;
          tenant_id: string;
          customer_id: string;
          customer_identity_id: string;
          email_normalized: string;
          invited_by_user_id?: string | null;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          token?: string;
          tenant_id?: string;
          customer_id?: string;
          customer_identity_id?: string;
          email_normalized?: string;
          invited_by_user_id?: string | null;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_portal_invites_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_portal_invites_customer_identity_id_fkey';
            columns: ['customer_identity_id'];
            isOneToOne: false;
            referencedRelation: 'customer_identities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_portal_invites_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      employee_invites: {
        Row: {
          token: string;
          tenant_id: string;
          email_normalized: string;
          invited_role: Database['public']['Enums']['tenant_role'];
          invited_by_user_id: string | null;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          token?: string;
          tenant_id: string;
          email_normalized: string;
          invited_role: Database['public']['Enums']['tenant_role'];
          invited_by_user_id?: string | null;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          token?: string;
          tenant_id?: string;
          email_normalized?: string;
          invited_role?: Database['public']['Enums']['tenant_role'];
          invited_by_user_id?: string | null;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'employee_invites_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      marketing_inquiries: {
        Row: {
          id: string;
          name: string;
          email: string;
          company: string | null;
          message: string;
          status: 'new' | 'contacted' | 'closed';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          company?: string | null;
          message: string;
          status?: 'new' | 'contacted' | 'closed';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          company?: string | null;
          message?: string;
          status?: 'new' | 'contacted' | 'closed';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      masquerade_sessions: {
        Row: {
          id: string;
          admin_user_id: string;
          target_tenant_id: string;
          started_at: string;
          ended_at: string | null;
        };
        Insert: {
          id?: string;
          admin_user_id: string;
          target_tenant_id: string;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          admin_user_id?: string;
          target_tenant_id?: string;
          started_at?: string;
          ended_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'masquerade_sessions_target_tenant_id_fkey';
            columns: ['target_tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          tenant_id: string;
          customer_identity_id: string;
          external_ref: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_identity_id: string;
          external_ref?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_identity_id?: string;
          external_ref?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_customer_identity_id_fkey';
            columns: ['customer_identity_id'];
            isOneToOne: false;
            referencedRelation: 'customer_identities';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customers_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_subscriptions: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          service_plan_id: string;
          status: Database['public']['Enums']['tenant_customer_subscription_status'];
          stripe_subscription_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          billing_cycle_anchor: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_id: string;
          service_plan_id: string;
          status?: Database['public']['Enums']['tenant_customer_subscription_status'];
          stripe_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          billing_cycle_anchor?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          service_plan_id?: string;
          status?: Database['public']['Enums']['tenant_customer_subscription_status'];
          stripe_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          billing_cycle_anchor?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_subscriptions_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_subscriptions_service_plan_id_fkey';
            columns: ['service_plan_id'];
            isOneToOne: false;
            referencedRelation: 'service_plans';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_subscriptions_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_invoice_payments: {
        Row: {
          id: string;
          tenant_id: string;
          invoice_id: string;
          amount_cents: number;
          method: 'cash' | 'check' | 'zelle' | 'card' | 'ach' | 'other';
          notes: string | null;
          recorded_at: string;
          created_at: string;
          recorded_via: Database['public']['Enums']['tenant_invoice_payment_recorded_via'];
          stripe_checkout_session_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_charge_id: string | null;
          stripe_balance_transaction_id: string | null;
          gross_amount_cents: number | null;
          stripe_fee_cents: number | null;
          application_fee_cents: number | null;
          net_amount_cents: number | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          invoice_id: string;
          amount_cents: number;
          method?: 'cash' | 'check' | 'zelle' | 'card' | 'ach' | 'other';
          notes?: string | null;
          recorded_at?: string;
          created_at?: string;
          recorded_via?: Database['public']['Enums']['tenant_invoice_payment_recorded_via'];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          stripe_balance_transaction_id?: string | null;
          gross_amount_cents?: number | null;
          stripe_fee_cents?: number | null;
          application_fee_cents?: number | null;
          net_amount_cents?: number | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          invoice_id?: string;
          amount_cents?: number;
          method?: 'cash' | 'check' | 'zelle' | 'card' | 'ach' | 'other';
          notes?: string | null;
          recorded_at?: string;
          created_at?: string;
          recorded_via?: Database['public']['Enums']['tenant_invoice_payment_recorded_via'];
          stripe_checkout_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_charge_id?: string | null;
          stripe_balance_transaction_id?: string | null;
          gross_amount_cents?: number | null;
          stripe_fee_cents?: number | null;
          application_fee_cents?: number | null;
          net_amount_cents?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_invoice_payments_invoice_id_fkey';
            columns: ['invoice_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_invoices';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_invoice_payments_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_invoices: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          visit_id: string | null;
          title: string;
          status: 'draft' | 'open' | 'paid' | 'void';
          currency: string;
          amount_cents: number;
          amount_paid_cents: number;
          due_date: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_id: string;
          visit_id?: string | null;
          title?: string;
          status?: 'draft' | 'open' | 'paid' | 'void';
          currency?: string;
          amount_cents: number;
          amount_paid_cents?: number;
          due_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          visit_id?: string | null;
          title?: string;
          status?: 'draft' | 'open' | 'paid' | 'void';
          currency?: string;
          amount_cents?: number;
          amount_paid_cents?: number;
          due_date?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_invoices_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_invoices_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      stripe_webhook_events: {
        Row: {
          id: string;
          stripe_event_id: string;
          event_type: string;
          livemode: boolean;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          stripe_event_id: string;
          event_type: string;
          livemode?: boolean;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          stripe_event_id?: string;
          event_type?: string;
          livemode?: boolean;
          received_at?: string;
          processed_at?: string | null;
        };
        Relationships: [];
      };
      tenant_billing_accounts: {
        Row: {
          id: string;
          tenant_id: string;
          status: 'trialing' | 'active' | 'past_due' | 'canceled';
          trial_started_at: string | null;
          trial_ends_at: string | null;
          activated_at: string | null;
          canceled_at: string | null;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          platform_plan: 'starter' | 'pro' | 'business' | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          status?: 'trialing' | 'active' | 'past_due' | 'canceled';
          trial_started_at?: string | null;
          trial_ends_at?: string | null;
          activated_at?: string | null;
          canceled_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          platform_plan?: 'starter' | 'pro' | 'business' | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          status?: 'trialing' | 'active' | 'past_due' | 'canceled';
          trial_started_at?: string | null;
          trial_ends_at?: string | null;
          activated_at?: string | null;
          canceled_at?: string | null;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          platform_plan?: 'starter' | 'pro' | 'business' | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_billing_accounts_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: true;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_memberships: {
        Row: {
          id: string;
          tenant_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'employee' | 'viewer';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          user_id: string;
          role: 'owner' | 'admin' | 'employee' | 'viewer';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          user_id?: string;
          role?: 'owner' | 'admin' | 'employee' | 'viewer';
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_memberships_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_operational_settings: {
        Row: {
          tenant_id: string;
          accepted_quote_schedule_mode: Database['public']['Enums']['accepted_quote_schedule_mode'];
          invoice_expectation: Database['public']['Enums']['tenant_invoice_expectation'];
          allowed_customer_payment_methods: string[];
          email_notify_quote_sent: boolean;
          email_notify_quote_accepted: boolean;
          email_notify_quote_declined: boolean;
          sms_notify_quote_sent: boolean;
          sms_notify_quote_accepted: boolean;
          sms_notify_quote_declined: boolean;
          check_reminder_hold_days: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          accepted_quote_schedule_mode?: Database['public']['Enums']['accepted_quote_schedule_mode'];
          invoice_expectation?: Database['public']['Enums']['tenant_invoice_expectation'];
          allowed_customer_payment_methods?: string[];
          email_notify_quote_sent?: boolean;
          email_notify_quote_accepted?: boolean;
          email_notify_quote_declined?: boolean;
          sms_notify_quote_sent?: boolean;
          sms_notify_quote_accepted?: boolean;
          sms_notify_quote_declined?: boolean;
          check_reminder_hold_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          accepted_quote_schedule_mode?: Database['public']['Enums']['accepted_quote_schedule_mode'];
          invoice_expectation?: Database['public']['Enums']['tenant_invoice_expectation'];
          allowed_customer_payment_methods?: string[];
          email_notify_quote_sent?: boolean;
          email_notify_quote_accepted?: boolean;
          email_notify_quote_declined?: boolean;
          sms_notify_quote_sent?: boolean;
          sms_notify_quote_accepted?: boolean;
          sms_notify_quote_declined?: boolean;
          check_reminder_hold_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_operational_settings_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: true;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_customer_profiles: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          company_name: string | null;
          preferred_contact_method: 'email' | 'phone' | 'sms' | null;
          preferred_payment_method: Database['public']['Enums']['tenant_payment_method'];
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_id: string;
          company_name?: string | null;
          preferred_contact_method?: 'email' | 'phone' | 'sms' | null;
          preferred_payment_method?: Database['public']['Enums']['tenant_payment_method'];
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          company_name?: string | null;
          preferred_contact_method?: 'email' | 'phone' | 'sms' | null;
          preferred_payment_method?: Database['public']['Enums']['tenant_payment_method'];
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_customer_profiles_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: true;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_customer_profiles_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_customer_properties: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          label: string | null;
          property_kind: 'residential' | 'commercial' | 'short_term_rental' | 'other';
          address_line1: string | null;
          address_line2: string | null;
          city: string | null;
          state: string | null;
          postal_code: string | null;
          site_notes: string | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_id: string;
          label?: string | null;
          property_kind?: 'residential' | 'commercial' | 'short_term_rental' | 'other';
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          site_notes?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          label?: string | null;
          property_kind?: 'residential' | 'commercial' | 'short_term_rental' | 'other';
          address_line1?: string | null;
          address_line2?: string | null;
          city?: string | null;
          state?: string | null;
          postal_code?: string | null;
          site_notes?: string | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_customer_properties_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_customer_properties_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_customer_stripe_customers: {
        Row: {
          tenant_id: string;
          customer_id: string;
          stripe_customer_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          customer_id: string;
          stripe_customer_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          customer_id?: string;
          stripe_customer_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_customer_stripe_customers_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_customer_stripe_customers_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_onboarding_profiles: {
        Row: {
          id: string;
          tenant_id: string;
          company_email: string | null;
          company_phone: string | null;
          company_website: string | null;
          service_area: string | null;
          team_size: string | null;
          business_type: string | null;
          referral_source: string | null;
          owner_name: string | null;
          owner_email: string | null;
          owner_phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          company_email?: string | null;
          company_phone?: string | null;
          company_website?: string | null;
          service_area?: string | null;
          team_size?: string | null;
          business_type?: string | null;
          referral_source?: string | null;
          owner_name?: string | null;
          owner_email?: string | null;
          owner_phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          company_email?: string | null;
          company_phone?: string | null;
          company_website?: string | null;
          service_area?: string | null;
          team_size?: string | null;
          business_type?: string | null;
          referral_source?: string | null;
          owner_name?: string | null;
          owner_email?: string | null;
          owner_phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_onboarding_profiles_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: true;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_quote_acceptance_snapshots: {
        Row: {
          id: string;
          quote_id: string;
          tenant_id: string;
          captured_at: string;
          payload: Json;
        };
        Insert: {
          id?: string;
          quote_id: string;
          tenant_id?: string;
          captured_at?: string;
          payload: Json;
        };
        Update: {
          id?: string;
          quote_id?: string;
          tenant_id?: string;
          captured_at?: string;
          payload?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_quote_acceptance_snapshots_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: true;
            referencedRelation: 'tenant_quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_quote_acceptance_snapshots_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_quote_acceptance_e_signatures: {
        Row: {
          quote_id: string;
          tenant_id: string;
          signer_auth_user_id: string | null;
          signature_kind: Database['public']['Enums']['quote_acceptance_signature_kind'];
          typed_full_name: string | null;
          drawn_png_base64: string | null;
          client_ip: string | null;
          user_agent: string | null;
          created_at: string;
        };
        Insert: {
          quote_id: string;
          tenant_id?: string;
          signer_auth_user_id?: string | null;
          signature_kind: Database['public']['Enums']['quote_acceptance_signature_kind'];
          typed_full_name?: string | null;
          drawn_png_base64?: string | null;
          client_ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Update: {
          quote_id?: string;
          tenant_id?: string;
          signer_auth_user_id?: string | null;
          signature_kind?: Database['public']['Enums']['quote_acceptance_signature_kind'];
          typed_full_name?: string | null;
          drawn_png_base64?: string | null;
          client_ip?: string | null;
          user_agent?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_quote_acceptance_e_signatures_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: true;
            referencedRelation: 'tenant_quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_quote_acceptance_e_signatures_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_quote_line_items: {
        Row: {
          id: string;
          quote_id: string;
          tenant_id: string;
          sort_order: number;
          service_label: string;
          frequency: Database['public']['Enums']['quote_line_frequency'];
          frequency_detail: string | null;
          amount_cents: number;
          line_discount_kind: Database['public']['Enums']['quote_line_discount_kind'];
          line_discount_value: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          quote_id: string;
          tenant_id?: string;
          sort_order?: number;
          service_label: string;
          frequency?: Database['public']['Enums']['quote_line_frequency'];
          frequency_detail?: string | null;
          amount_cents: number;
          line_discount_kind?: Database['public']['Enums']['quote_line_discount_kind'];
          line_discount_value?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          quote_id?: string;
          tenant_id?: string;
          sort_order?: number;
          service_label?: string;
          frequency?: Database['public']['Enums']['quote_line_frequency'];
          frequency_detail?: string | null;
          amount_cents?: number;
          line_discount_kind?: Database['public']['Enums']['quote_line_discount_kind'];
          line_discount_value?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_quote_line_items_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_quote_line_items_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_quotes: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          property_id: string | null;
          title: string;
          status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
          amount_cents: number | null;
          currency: string;
          tax_mode: Database['public']['Enums']['quote_tax_mode'];
          tax_rate_bps: number;
          quote_discount_kind: Database['public']['Enums']['quote_discount_kind'];
          quote_discount_value: number;
          notes: string | null;
          valid_until: string | null;
          quote_group_id: string;
          version_number: number;
          version_reason: string | null;
          supersedes_quote_id: string | null;
          superseded_by_quote_id: string | null;
          accepted_at: string | null;
          is_locked: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_id: string;
          property_id?: string | null;
          title: string;
          status?: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
          amount_cents?: number | null;
          currency?: string;
          tax_mode?: Database['public']['Enums']['quote_tax_mode'];
          tax_rate_bps?: number;
          quote_discount_kind?: Database['public']['Enums']['quote_discount_kind'];
          quote_discount_value?: number;
          notes?: string | null;
          valid_until?: string | null;
          quote_group_id?: string;
          version_number?: number;
          version_reason?: string | null;
          supersedes_quote_id?: string | null;
          superseded_by_quote_id?: string | null;
          accepted_at?: string | null;
          is_locked?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          property_id?: string | null;
          title?: string;
          status?: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
          amount_cents?: number | null;
          currency?: string;
          tax_mode?: Database['public']['Enums']['quote_tax_mode'];
          tax_rate_bps?: number;
          quote_discount_kind?: Database['public']['Enums']['quote_discount_kind'];
          quote_discount_value?: number;
          notes?: string | null;
          valid_until?: string | null;
          quote_group_id?: string;
          version_number?: number;
          version_reason?: string | null;
          supersedes_quote_id?: string | null;
          superseded_by_quote_id?: string | null;
          accepted_at?: string | null;
          is_locked?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_quotes_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_quotes_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_customer_properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_quotes_superseded_by_quote_id_fkey';
            columns: ['superseded_by_quote_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_quotes_supersedes_quote_id_fkey';
            columns: ['supersedes_quote_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_quotes_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      service_plans: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          description: string | null;
          amount_cents: number;
          currency: string;
          billing_interval: Database['public']['Enums']['service_plan_billing_interval'];
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          description?: string | null;
          amount_cents: number;
          currency?: string;
          billing_interval?: Database['public']['Enums']['service_plan_billing_interval'];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          description?: string | null;
          amount_cents?: number;
          currency?: string;
          billing_interval?: Database['public']['Enums']['service_plan_billing_interval'];
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_plans_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      recurring_appointment_rules: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          property_id: string | null;
          title: string;
          rrule_definition: string;
          anchor_starts_at: string;
          visit_duration_minutes: number;
          horizon_days: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_id: string;
          property_id?: string | null;
          title?: string;
          rrule_definition: string;
          anchor_starts_at: string;
          visit_duration_minutes?: number;
          horizon_days?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          property_id?: string | null;
          title?: string;
          rrule_definition?: string;
          anchor_starts_at?: string;
          visit_duration_minutes?: number;
          horizon_days?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recurring_appointment_rules_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recurring_appointment_rules_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_customer_properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recurring_appointment_rules_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      visit_reschedule_requests: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          visit_id: string;
          status: Database['public']['Enums']['visit_reschedule_request_status'];
          customer_note: string;
          preferred_starts_at: string | null;
          preferred_ends_at: string | null;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
          resolved_by_user_id: string | null;
          tenant_response_note: string | null;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_id: string;
          visit_id: string;
          status?: Database['public']['Enums']['visit_reschedule_request_status'];
          customer_note?: string;
          preferred_starts_at?: string | null;
          preferred_ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          tenant_response_note?: string | null;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          visit_id?: string;
          status?: Database['public']['Enums']['visit_reschedule_request_status'];
          customer_note?: string;
          preferred_starts_at?: string | null;
          preferred_ends_at?: string | null;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
          resolved_by_user_id?: string | null;
          tenant_response_note?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'visit_reschedule_requests_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visit_reschedule_requests_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'visit_reschedule_requests_visit_id_fkey';
            columns: ['visit_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_scheduled_visits';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_scheduled_visits: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          property_id: string | null;
          quote_id: string | null;
          title: string;
          starts_at: string;
          ends_at: string;
          status: 'scheduled' | 'completed' | 'cancelled';
          notes: string | null;
          recurring_rule_id: string | null;
          checked_in_at: string | null;
          checked_in_by_user_id: string | null;
          completed_at: string | null;
          completed_by_user_id: string | null;
          completion_payment_collected: boolean | null;
          completion_collected_method: Database['public']['Enums']['tenant_payment_method'] | null;
          completion_check_number: string | null;
          completion_collected_amount_cents: number | null;
          completion_invoice_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_id: string;
          property_id?: string | null;
          quote_id?: string | null;
          title?: string;
          starts_at: string;
          ends_at: string;
          status?: 'scheduled' | 'completed' | 'cancelled';
          notes?: string | null;
          recurring_rule_id?: string | null;
          checked_in_at?: string | null;
          checked_in_by_user_id?: string | null;
          completed_at?: string | null;
          completed_by_user_id?: string | null;
          completion_payment_collected?: boolean | null;
          completion_collected_method?: Database['public']['Enums']['tenant_payment_method'] | null;
          completion_check_number?: string | null;
          completion_collected_amount_cents?: number | null;
          completion_invoice_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string;
          property_id?: string | null;
          quote_id?: string | null;
          title?: string;
          starts_at?: string;
          ends_at?: string;
          status?: 'scheduled' | 'completed' | 'cancelled';
          notes?: string | null;
          recurring_rule_id?: string | null;
          checked_in_at?: string | null;
          checked_in_by_user_id?: string | null;
          completed_at?: string | null;
          completed_by_user_id?: string | null;
          completion_payment_collected?: boolean | null;
          completion_collected_method?: Database['public']['Enums']['tenant_payment_method'] | null;
          completion_check_number?: string | null;
          completion_collected_amount_cents?: number | null;
          completion_invoice_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_scheduled_visits_recurring_rule_id_fkey';
            columns: ['recurring_rule_id'];
            isOneToOne: false;
            referencedRelation: 'recurring_appointment_rules';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_scheduled_visits_customer_id_fkey';
            columns: ['customer_id'];
            isOneToOne: false;
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_scheduled_visits_property_id_fkey';
            columns: ['property_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_customer_properties';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_scheduled_visits_quote_id_fkey';
            columns: ['quote_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_quotes';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_scheduled_visits_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_scheduled_visit_assignees: {
        Row: {
          visit_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          visit_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          visit_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_scheduled_visit_assignees_visit_id_fkey';
            columns: ['visit_id'];
            isOneToOne: false;
            referencedRelation: 'tenant_scheduled_visits';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenant_scheduled_visit_assignees_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'user_profiles';
            referencedColumns: ['user_id'];
          },
        ];
      };
      tenant_stripe_connect_accounts: {
        Row: {
          tenant_id: string;
          stripe_account_id: string;
          charges_enabled: boolean;
          payouts_enabled: boolean;
          details_submitted: boolean;
          requirements_disabled_reason: string | null;
          requirements_currently_due: Json | null;
          last_event_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          tenant_id: string;
          stripe_account_id: string;
          charges_enabled?: boolean;
          payouts_enabled?: boolean;
          details_submitted?: boolean;
          requirements_disabled_reason?: string | null;
          requirements_currently_due?: Json | null;
          last_event_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          tenant_id?: string;
          stripe_account_id?: string;
          charges_enabled?: boolean;
          payouts_enabled?: boolean;
          details_submitted?: boolean;
          requirements_disabled_reason?: string | null;
          requirements_currently_due?: Json | null;
          last_event_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_stripe_connect_accounts_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: true;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_stripe_disputes: {
        Row: {
          id: string;
          tenant_id: string;
          stripe_dispute_id: string;
          stripe_charge_id: string | null;
          amount_cents: number;
          status: string;
          raw: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          stripe_dispute_id: string;
          stripe_charge_id?: string | null;
          amount_cents: number;
          status: string;
          raw?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stripe_dispute_id?: string;
          stripe_charge_id?: string | null;
          amount_cents?: number;
          status?: string;
          raw?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_stripe_disputes_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_stripe_payouts: {
        Row: {
          id: string;
          tenant_id: string;
          stripe_payout_id: string;
          amount_cents: number;
          status: string | null;
          arrival_date: string | null;
          raw: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          stripe_payout_id: string;
          amount_cents: number;
          status?: string | null;
          arrival_date?: string | null;
          raw?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stripe_payout_id?: string;
          amount_cents?: number;
          status?: string | null;
          arrival_date?: string | null;
          raw?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_stripe_payouts_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_stripe_refunds: {
        Row: {
          id: string;
          tenant_id: string;
          stripe_refund_id: string;
          stripe_charge_id: string | null;
          amount_cents: number;
          status: string | null;
          raw: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          stripe_refund_id: string;
          stripe_charge_id?: string | null;
          amount_cents: number;
          status?: string | null;
          raw?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          stripe_refund_id?: string;
          stripe_charge_id?: string | null;
          amount_cents?: number;
          status?: string | null;
          raw?: Json | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_stripe_refunds_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_usage_snapshots: {
        Row: {
          id: string;
          tenant_id: string;
          snapshot_date: string;
          active_user_count: number;
          active_customer_count: number;
          sms_segments_used: number;
          email_sends: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          snapshot_date: string;
          active_user_count?: number;
          active_customer_count?: number;
          sms_segments_used?: number;
          email_sends?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          snapshot_date?: string;
          active_user_count?: number;
          active_customer_count?: number;
          sms_segments_used?: number;
          email_sends?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_usage_snapshots_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      tenants: {
        Row: {
          id: string;
          slug: string;
          name: string;
          timezone: string;
          is_active: boolean;
          stripe_connect_status: Database['public']['Enums']['tenant_stripe_connect_status'];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          timezone?: string;
          is_active?: boolean;
          stripe_connect_status?: Database['public']['Enums']['tenant_stripe_connect_status'];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          timezone?: string;
          is_active?: boolean;
          stripe_connect_status?: Database['public']['Enums']['tenant_stripe_connect_status'];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          user_id: string;
          app_role: 'super_admin' | 'admin' | 'employee' | 'customer';
          display_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          app_role?: 'super_admin' | 'admin' | 'employee' | 'customer';
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          app_role?: 'super_admin' | 'admin' | 'employee' | 'customer';
          display_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      expire_sent_quotes_past_valid_until: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      tenant_quote_create_with_line_items: {
        Args: {
          p_tenant_id: string;
          p_customer_id: string;
          p_property_id: string | null;
          p_title: string;
          p_status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
          p_amount_cents: number | null;
          p_notes: string | null;
          p_valid_until: string | null;
          p_tax_mode: Database['public']['Enums']['quote_tax_mode'];
          p_tax_rate_bps: number;
          p_quote_discount_kind: Database['public']['Enums']['quote_discount_kind'];
          p_quote_discount_value: number;
          p_line_items: Json;
        };
        Returns: string;
      };
      tenant_quote_save_with_line_items: {
        Args: {
          p_quote_id: string;
          p_tenant_id: string;
          p_title: string;
          p_status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
          p_customer_id: string;
          p_property_id: string | null;
          p_amount_cents: number | null;
          p_notes: string | null;
          p_valid_until: string | null;
          p_tax_mode: Database['public']['Enums']['quote_tax_mode'];
          p_tax_rate_bps: number;
          p_quote_discount_kind: Database['public']['Enums']['quote_discount_kind'];
          p_quote_discount_value: number;
          p_line_items: Json;
        };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: 'super_admin' | 'admin' | 'employee' | 'customer';
      tenant_role: 'owner' | 'admin' | 'employee' | 'viewer';
      tenant_billing_status: 'trialing' | 'active' | 'past_due' | 'canceled';
      platform_plan_tier: 'starter' | 'pro' | 'business';
      quote_status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
      quote_line_frequency: 'one_time' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
      quote_tax_mode: 'none' | 'exclusive';
      quote_discount_kind: 'none' | 'percent' | 'fixed_cents';
      quote_line_discount_kind: 'none' | 'percent' | 'fixed_cents';
      customer_property_kind: 'residential' | 'commercial' | 'short_term_rental' | 'other';
      visit_status: 'scheduled' | 'completed' | 'cancelled';
      tenant_invoice_status: 'draft' | 'open' | 'paid' | 'void';
      tenant_payment_method: 'cash' | 'check' | 'zelle' | 'card' | 'ach' | 'other';
      marketing_inquiry_status: 'new' | 'contacted' | 'closed';
      quote_acceptance_signature_kind: 'typed_name' | 'drawn_png';
      accepted_quote_schedule_mode: 'prompt_staff' | 'auto_schedule';
      tenant_invoice_expectation: 'prepay' | 'pay_after_service';
      tenant_invoice_payment_recorded_via: 'manual' | 'stripe_checkout';
      tenant_stripe_connect_status: 'not_started' | 'pending' | 'complete' | 'restricted';
      service_plan_billing_interval: 'week' | 'month' | 'year';
      visit_reschedule_request_status: 'pending' | 'completed' | 'declined' | 'withdrawn';
      tenant_customer_subscription_status:
        | 'incomplete'
        | 'incomplete_expired'
        | 'trialing'
        | 'active'
        | 'past_due'
        | 'canceled'
        | 'unpaid'
        | 'paused';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
