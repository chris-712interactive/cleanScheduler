import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { escapeIlikeMetacharacters } from '@/lib/tenant/customerDirectorySearch';

type Admin = SupabaseClient<Database>;

const INVOICE_STATUSES = ['draft', 'open', 'paid', 'void'] as const;
type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CUSTOMER_MATCH_LIMIT = 80;

export function parseInvoiceListQuery(raw: string | undefined): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 120);
}

export function invoiceStatusFromQuery(query: string): InvoiceStatus | null {
  const normalized = query.trim().toLowerCase();
  return INVOICE_STATUSES.find((status) => status === normalized) ?? null;
}

/** Whole-query amounts such as `$200`, `200.00`, or `200`. */
export function invoiceAmountCentsFromQuery(query: string): number | null {
  const match = query.trim().match(/^\$?\s*(\d{1,7})(?:\.(\d{2}))?$/);
  if (!match) return null;
  const dollars = Number(match[1]);
  const cents = Number(match[2] ?? '0');
  if (!Number.isSafeInteger(dollars) || !Number.isSafeInteger(cents)) return null;
  return dollars * 100 + cents;
}

export function invoiceIdEqualsFromQuery(query: string): string | null {
  const trimmed = query.trim();
  return UUID_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

/**
 * Hex prefix for a displayed invoice number (`INV-AF1A7F` is the first 6
 * hex characters of the id). Bare numbers shorter than 6 digits stay out
 * so a street number does not range-match invoice ids.
 */
export function invoiceIdPrefixFromQuery(query: string): string | null {
  if (invoiceIdEqualsFromQuery(query)) return null;
  const trimmed = query.trim();
  let rest = trimmed.replace(/^invoice\s*#?\s*/i, '');
  rest = rest.replace(/^#/, '');
  rest = rest.replace(/^inv[-\s#]*/i, '');
  rest = rest.replace(/[-\s]/g, '');
  if (!/^[0-9a-f]+$/i.test(rest)) return null;
  const looksLikeReference = /inv|#/i.test(trimmed);
  if (rest.length < (looksLikeReference ? 3 : 6)) return null;
  return rest.toLowerCase().slice(0, 8);
}

export function uuidPrefixBounds(hexPrefix: string): { gte: string; lt: string | null } | null {
  const hex = hexPrefix.toLowerCase();
  if (!/^[0-9a-f]{1,32}$/.test(hex)) return null;
  const gte = formatUuid(hex.padEnd(32, '0'));
  const max = 1n << BigInt(hex.length * 4);
  const next = BigInt(`0x${hex}`) + 1n;
  if (next >= max) return { gte, lt: null };
  const nextHex = next.toString(16).padStart(hex.length, '0');
  return { gte, lt: formatUuid(nextHex.padEnd(32, '0')) };
}

function formatUuid(hex32: string): string {
  return `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20, 32)}`;
}

function quotedIlike(column: string, raw: string): string {
  const inner = escapeIlikeMetacharacters(raw.trim());
  const pattern = `%${inner}%`;
  // Quote only when PostgREST reserved characters appear. Spaces stay unquoted,
  // matching the customer directory filters that already run in production.
  const value = /[,.():"]/.test(pattern) ? `"${pattern.replace(/"/g, '""')}"` : pattern;
  return `${column}.ilike.${value}`;
}

function quotedIlikeAny(columns: string[], raw: string): string {
  return columns.map((column) => quotedIlike(column, raw)).join(',');
}

export function buildInvoiceListOrFilter(params: {
  query: string;
  customerIds: string[];
  propertyIds?: string[];
}): string | null {
  const query = params.query.trim();
  if (!query) return null;

  const parts = [
    quotedIlike('title', query),
    quotedIlike('notes', query),
    quotedIlike('applied_promo_code', query),
  ];

  const exactId = invoiceIdEqualsFromQuery(query);
  if (exactId) {
    parts.push(`id.eq.${exactId}`);
  } else {
    const prefix = invoiceIdPrefixFromQuery(query);
    const bounds = prefix ? uuidPrefixBounds(prefix) : null;
    if (bounds) {
      parts.push(
        bounds.lt ? `and(id.gte.${bounds.gte},id.lt.${bounds.lt})` : `id.gte.${bounds.gte}`,
      );
    }
  }

  const status = invoiceStatusFromQuery(query);
  if (status) parts.push(`status.eq.${status}`);

  const amountCents = invoiceAmountCentsFromQuery(query);
  if (amountCents != null) {
    parts.push(`amount_cents.eq.${amountCents}`, `amount_paid_cents.eq.${amountCents}`);
  }

  const customerIds = [
    ...new Set(params.customerIds.filter((id) => UUID_RE.test(id)).map((id) => id.toLowerCase())),
  ].slice(0, CUSTOMER_MATCH_LIMIT);
  if (customerIds.length > 0) {
    parts.push(`customer_id.in.(${customerIds.join(',')})`);
  }

  const propertyIds = [
    ...new Set(
      (params.propertyIds ?? []).filter((id) => UUID_RE.test(id)).map((id) => id.toLowerCase()),
    ),
  ].slice(0, CUSTOMER_MATCH_LIMIT);
  if (propertyIds.length > 0) {
    parts.push(`property_id.in.(${propertyIds.join(',')})`);
  }

  return parts.join(',');
}

function identitySearchOrClause(query: string): string {
  const parts = [quotedIlikeAny(['first_name', 'last_name', 'full_name', 'email', 'phone'], query)];
  const digits = query.replace(/\D/g, '');
  if (digits.length >= 3 && digits !== query.trim()) {
    parts.push(quotedIlike('phone', digits));
  }
  return parts.join(',');
}

function propertySearchOrClause(query: string): string {
  return quotedIlikeAny(
    [
      'address_line1',
      'address_line2',
      'city',
      'state',
      'postal_code',
      'label',
      'community_name',
      'building_name',
    ],
    query,
  );
}

export async function findCustomerIdsForInvoiceSearch(
  db: Admin,
  tenantId: string,
  query: string,
): Promise<{ customerIds: string[]; propertyIds: string[]; error: string | null }> {
  const trimmed = query.trim();
  if (!trimmed) return { customerIds: [], propertyIds: [], error: null };

  const [identResult, propertyResult] = await Promise.all([
    db
      .from('customer_identities')
      .select('id')
      .or(identitySearchOrClause(trimmed))
      .limit(CUSTOMER_MATCH_LIMIT),
    db
      .from('tenant_customer_properties')
      .select('id')
      .eq('tenant_id', tenantId)
      .or(propertySearchOrClause(trimmed))
      .limit(CUSTOMER_MATCH_LIMIT),
  ]);

  const lookupError = identResult.error ?? propertyResult.error;
  if (lookupError) return { customerIds: [], propertyIds: [], error: lookupError.message };

  const identityIds = (identResult.data ?? [])
    .map((row) => row.id)
    .filter((id) => UUID_RE.test(id));
  let identityCustomerIds: string[] = [];
  if (identityIds.length > 0) {
    const customers = await db
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .in('customer_identity_id', identityIds)
      .limit(CUSTOMER_MATCH_LIMIT);
    if (customers.error)
      return { customerIds: [], propertyIds: [], error: customers.error.message };
    identityCustomerIds = (customers.data ?? []).map((row) => row.id);
  }

  const propertyIds = (propertyResult.data ?? [])
    .map((row) => row.id)
    .filter((id) => UUID_RE.test(id));
  const customerIds = [...new Set(identityCustomerIds)].filter((id) => UUID_RE.test(id));
  return { customerIds, propertyIds, error: null };
}
