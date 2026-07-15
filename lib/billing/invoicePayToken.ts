import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';

type Admin = SupabaseClient<Database>;

const TOKEN_TTL_DAYS = 30;

export function guestInvoicePayUrl(token: string): string {
  return `${getPublicOrigin(null)}/pay/${encodeURIComponent(token)}`;
}

export async function createOrReuseInvoicePayToken(
  admin: Admin,
  params: { tenantId: string; invoiceId: string },
): Promise<string | null> {
  const now = Date.now();
  const { data: existing } = await admin
    .from('tenant_invoice_pay_tokens')
    .select('token, expires_at, used_at')
    .eq('tenant_id', params.tenantId)
    .eq('invoice_id', params.invoiceId)
    .is('used_at', null)
    .gt('expires_at', new Date(now).toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.token) return existing.token;

  const token = randomBytes(24).toString('base64url');
  const expiresAt = new Date(now + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from('tenant_invoice_pay_tokens').insert({
    tenant_id: params.tenantId,
    invoice_id: params.invoiceId,
    token,
    expires_at: expiresAt,
  });

  if (error) {
    console.error('[invoicePayToken]', error.message);
    return null;
  }
  return token;
}
