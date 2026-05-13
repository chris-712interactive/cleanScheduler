/**
 * Hand-maintained schema mirror for migrations 0001–0015.
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
          full_name: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id?: string | null;
          email?: string | null;
          full_name?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string | null;
          email?: string | null;
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
      tenant_customer_profiles: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string;
          company_name: string | null;
          preferred_contact_method: 'email' | 'phone' | 'sms' | null;
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
      tenant_quotes: {
        Row: {
          id: string;
          tenant_id: string;
          customer_id: string | null;
          property_id: string | null;
          title: string;
          status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
          amount_cents: number | null;
          currency: string;
          notes: string | null;
          valid_until: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          customer_id?: string | null;
          property_id?: string | null;
          title: string;
          status?: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
          amount_cents?: number | null;
          currency?: string;
          notes?: string | null;
          valid_until?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          customer_id?: string | null;
          property_id?: string | null;
          title?: string;
          status?: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
          amount_cents?: number | null;
          currency?: string;
          notes?: string | null;
          valid_until?: string | null;
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
            foreignKeyName: 'tenant_quotes_tenant_id_fkey';
            columns: ['tenant_id'];
            isOneToOne: false;
            referencedRelation: 'tenants';
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
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
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
      tenants: {
        Row: {
          id: string;
          slug: string;
          name: string;
          timezone: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          timezone?: string;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          timezone?: string;
          is_active?: boolean;
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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          app_role?: 'super_admin' | 'admin' | 'employee' | 'customer';
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          app_role?: 'super_admin' | 'admin' | 'employee' | 'customer';
          display_name?: string | null;
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
      [_ in never]: never;
    };
    Enums: {
      app_role: 'super_admin' | 'admin' | 'employee' | 'customer';
      tenant_role: 'owner' | 'admin' | 'employee' | 'viewer';
      tenant_billing_status: 'trialing' | 'active' | 'past_due' | 'canceled';
      platform_plan_tier: 'starter' | 'pro' | 'business';
      quote_status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
      customer_property_kind: 'residential' | 'commercial' | 'short_term_rental' | 'other';
      visit_status: 'scheduled' | 'completed' | 'cancelled';
      tenant_invoice_status: 'draft' | 'open' | 'paid' | 'void';
      tenant_payment_method: 'cash' | 'check' | 'zelle' | 'card' | 'ach' | 'other';
      marketing_inquiry_status: 'new' | 'contacted' | 'closed';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
