import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { escapeIlikeMetacharacters } from '@/lib/tenant/customerDirectorySearch';

type Admin = SupabaseClient<Database>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AdminTenantSearchKind =
  'connect_account' | 'stripe_customer' | 'stripe_subscription' | 'tenant_id' | 'slug_or_name';

export type AdminTenantSearchHit = {
  tenantId: string;
  matchedOn: AdminTenantSearchKind;
  matchedValue: string;
};

export function parseAdminTenantSearchQuery(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 200);
}

export function classifyAdminTenantSearchQuery(query: string): AdminTenantSearchKind {
  const q = query.trim();
  if (/^acct_/i.test(q)) return 'connect_account';
  if (/^cus_/i.test(q)) return 'stripe_customer';
  if (/^sub_/i.test(q)) return 'stripe_subscription';
  if (UUID_RE.test(q)) return 'tenant_id';
  return 'slug_or_name';
}

/**
 * Resolve tenant IDs from Stripe IDs, tenant UUID, slug, or name.
 * Used by Admin → Tenants search for fraud investigation.
 */
export async function searchAdminTenantIds(
  admin: Admin,
  query: string,
): Promise<{ hits: AdminTenantSearchHit[]; error: string | null }> {
  const q = parseAdminTenantSearchQuery(query);
  if (!q) return { hits: [], error: null };

  const kind = classifyAdminTenantSearchQuery(q);

  try {
    if (kind === 'connect_account') {
      const { data, error } = await admin
        .from('tenant_stripe_connect_accounts')
        .select('tenant_id, stripe_account_id')
        .eq('stripe_account_id', q)
        .limit(20);
      if (error) return { hits: [], error: error.message };
      return {
        hits: (data ?? []).map((row) => ({
          tenantId: row.tenant_id,
          matchedOn: kind,
          matchedValue: row.stripe_account_id,
        })),
        error: null,
      };
    }

    if (kind === 'stripe_customer') {
      const { data, error } = await admin
        .from('tenant_billing_accounts')
        .select('tenant_id, stripe_customer_id')
        .eq('stripe_customer_id', q)
        .limit(20);
      if (error) return { hits: [], error: error.message };
      return {
        hits: (data ?? [])
          .filter((row) => row.stripe_customer_id)
          .map((row) => ({
            tenantId: row.tenant_id,
            matchedOn: kind,
            matchedValue: row.stripe_customer_id as string,
          })),
        error: null,
      };
    }

    if (kind === 'stripe_subscription') {
      const { data, error } = await admin
        .from('tenant_billing_accounts')
        .select('tenant_id, stripe_subscription_id')
        .eq('stripe_subscription_id', q)
        .limit(20);
      if (error) return { hits: [], error: error.message };
      return {
        hits: (data ?? [])
          .filter((row) => row.stripe_subscription_id)
          .map((row) => ({
            tenantId: row.tenant_id,
            matchedOn: kind,
            matchedValue: row.stripe_subscription_id as string,
          })),
        error: null,
      };
    }

    if (kind === 'tenant_id') {
      const { data, error } = await admin.from('tenants').select('id').eq('id', q).maybeSingle();
      if (error) return { hits: [], error: error.message };
      if (!data) return { hits: [], error: null };
      return {
        hits: [{ tenantId: data.id, matchedOn: kind, matchedValue: data.id }],
        error: null,
      };
    }

    const slug = q.toLowerCase();
    const { data: exactSlug, error: exactErr } = await admin
      .from('tenants')
      .select('id, slug')
      .eq('slug', slug)
      .maybeSingle();
    if (exactErr) return { hits: [], error: exactErr.message };
    if (exactSlug) {
      return {
        hits: [{ tenantId: exactSlug.id, matchedOn: kind, matchedValue: exactSlug.slug }],
        error: null,
      };
    }

    const pat = `%${escapeIlikeMetacharacters(q)}%`;
    const { data: fuzzy, error: fuzzyErr } = await admin
      .from('tenants')
      .select('id, slug, name')
      .or(`slug.ilike.${pat},name.ilike.${pat}`)
      .order('created_at', { ascending: false })
      .limit(50);
    if (fuzzyErr) return { hits: [], error: fuzzyErr.message };

    return {
      hits: (fuzzy ?? []).map((row) => ({
        tenantId: row.id,
        matchedOn: kind,
        matchedValue: row.slug.toLowerCase().includes(slug) ? row.slug : row.name,
      })),
      error: null,
    };
  } catch (error) {
    return {
      hits: [],
      error: error instanceof Error ? error.message : 'Tenant search failed.',
    };
  }
}

export function adminTenantSearchKindLabel(kind: AdminTenantSearchKind): string {
  switch (kind) {
    case 'connect_account':
      return 'Connect account';
    case 'stripe_customer':
      return 'Stripe customer';
    case 'stripe_subscription':
      return 'Stripe subscription';
    case 'tenant_id':
      return 'Tenant ID';
    case 'slug_or_name':
      return 'Slug / name';
    default:
      return kind;
  }
}
