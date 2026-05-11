/**
 * Hand-maintained schema mirror for migrations 0001–0009.
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
            foreignKeyName: 'tenant_quotes_tenant_id_fkey';
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
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
