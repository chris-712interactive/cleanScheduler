import type { SupabaseClient } from '@supabase/supabase-js';
import { escapeIlikeMetacharacters } from '@/lib/tenant/customerDirectorySearch';
import type { Database } from '@/lib/supabase/database.types';

type AdminClient = SupabaseClient<Database>;

/** Recipient statuses where a send was attempted or completed. */
export const OUTREACH_SENT_RECIPIENT_STATUSES = ['sent', 'delivered', 'bounced', 'failed'] as const;

export type OutreachRecipientSearchRow = {
  id: string;
  campaign_id: string;
  business_name: string | null;
  owner_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  county: string | null;
  state: string | null;
  status: string;
  response_status: string;
  sent_at: string | null;
  opened_at: string | null;
  campaign: { id: string; name: string } | null;
};

export function parseOutreachSearchQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return '';
  return value.trim();
}

/** Build `ilike` filters for Supabase `.or()` on outreach recipient contact fields. */
export function outreachRecipientSearchOrClause(trimmedQuery: string): string {
  const inner = escapeIlikeMetacharacters(trimmedQuery);
  const pat = `%${inner}%`;
  const parts = [
    `business_name.ilike.${pat}`,
    `owner_name.ilike.${pat}`,
    `email.ilike.${pat}`,
    `email_normalized.ilike.${pat}`,
    `phone.ilike.${pat}`,
    `city.ilike.${pat}`,
    `county.ilike.${pat}`,
    `state.ilike.${pat}`,
  ];

  const digits = trimmedQuery.replace(/\D/g, '');
  if (digits.length >= 3 && digits !== trimmedQuery) {
    const digitPat = `%${escapeIlikeMetacharacters(digits)}%`;
    parts.push(`phone.ilike.${digitPat}`);
  }

  return parts.join(',');
}

export async function searchOutreachRecipients(
  admin: AdminClient,
  query: string,
  options?: { limit?: number },
): Promise<{ rows: OutreachRecipientSearchRow[]; truncated: boolean }> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { rows: [], truncated: false };
  }

  const limit = options?.limit ?? 50;

  const { data, error } = await admin
    .from('platform_outreach_recipients')
    .select(
      'id, campaign_id, business_name, owner_name, email, phone, city, county, state, status, response_status, sent_at, opened_at, campaign:platform_outreach_campaigns(id, name)',
    )
    .in('status', [...OUTREACH_SENT_RECIPIENT_STATUSES])
    .or(outreachRecipientSearchOrClause(trimmed))
    .order('sent_at', { ascending: false, nullsFirst: false })
    .limit(limit + 1);

  if (error) {
    throw new Error(error.message);
  }

  const rawRows = data ?? [];
  const truncated = rawRows.length > limit;
  const rows = (truncated ? rawRows.slice(0, limit) : rawRows).map((row) => ({
    id: row.id,
    campaign_id: row.campaign_id,
    business_name: row.business_name,
    owner_name: row.owner_name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    county: row.county,
    state: row.state,
    status: row.status,
    response_status: row.response_status,
    sent_at: row.sent_at,
    opened_at: row.opened_at,
    campaign: Array.isArray(row.campaign)
      ? (row.campaign[0] ?? null)
      : (row.campaign as OutreachRecipientSearchRow['campaign']),
  }));

  return { rows, truncated };
}
