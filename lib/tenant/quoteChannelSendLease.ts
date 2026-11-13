import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import {
  CHANNEL_SEND_LEASE_MS,
  quoteChannelProviderKey,
  type QuoteChannel,
} from '@/lib/tenant/quoteCreateIdempotency';

export { CHANNEL_SEND_LEASE_MS, quoteChannelProviderKey };
export type { QuoteChannel };

type Admin = SupabaseClient<Database>;

export type QuoteChannelLeaseState = 'sending' | 'unknown' | 'ok' | 'failed';

export type QuoteChannelClaim =
  | {
      ok: true;
      claimed: true;
      providerKey: string;
      leaseExpiresAt: string;
    }
  | {
      ok: true;
      claimed: false;
      providerKey: string;
      state: QuoteChannelLeaseState | 'absent';
      leaseExpiresAt: string;
    }
  | { ok: false; missingMigration: boolean };

function isLeaseState(value: unknown): value is QuoteChannelLeaseState {
  return value === 'sending' || value === 'unknown' || value === 'ok' || value === 'failed';
}

export function missingQuoteChannelLeaseMigration(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883' || error.code === '42P01') return true;
  const message = (error.message ?? '').toLowerCase();
  return (
    (message.includes('claim_quote_channel_send') ||
      message.includes('tenant_quote_channel_sends')) &&
    (message.includes('does not exist') ||
      message.includes('schema cache') ||
      message.includes('could not find'))
  );
}

function readClaim(value: unknown): QuoteChannelClaim {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: true, claimed: false, providerKey: '', state: 'absent', leaseExpiresAt: '' };
  }
  const record = value as Record<string, unknown>;
  const providerKey = typeof record.provider_key === 'string' ? record.provider_key : '';
  const leaseExpiresAt = typeof record.lease_expires_at === 'string' ? record.lease_expires_at : '';
  const state = isLeaseState(record.state) ? record.state : 'absent';
  if (record.claimed === true && providerKey && leaseExpiresAt) {
    return { ok: true, claimed: true, providerKey, leaseExpiresAt };
  }
  return { ok: true, claimed: false, providerKey, state, leaseExpiresAt };
}

/**
 * At most one provider call per step. Tenant id is the membership id the caller
 * already resolved. This does not read user_metadata.
 */
export async function claimQuoteChannelSend(input: {
  admin: Admin;
  tenantId: string;
  idempotencyKey: string;
  channel: QuoteChannel;
  ownerToken: string;
  quoteId: string;
  nowMs: number;
}): Promise<QuoteChannelClaim> {
  const leaseExpiresAt = new Date(input.nowMs + CHANNEL_SEND_LEASE_MS).toISOString();
  const { data, error } = await input.admin.rpc('claim_quote_channel_send', {
    p_tenant_id: input.tenantId,
    p_idempotency_key: input.idempotencyKey,
    p_channel: input.channel,
    p_owner_token: input.ownerToken,
    p_provider_key: quoteChannelProviderKey(input.channel, input.quoteId),
    p_lease_expires_at: leaseExpiresAt,
  });
  if (error) {
    console.error('[createTenantQuote] channel lease was not claimed');
    return { ok: false, missingMigration: missingQuoteChannelLeaseMigration(error) };
  }
  return readClaim(data);
}

async function writeLease(input: {
  admin: Admin;
  tenantId: string;
  idempotencyKey: string;
  channel: QuoteChannel;
  ownerToken: string;
  fromStates: QuoteChannelLeaseState[];
  patch: { state: QuoteChannelLeaseState; lease_expires_at?: string };
}): Promise<boolean> {
  const { data, error } = await input.admin
    .from('tenant_quote_channel_sends')
    .update({ ...input.patch, updated_at: new Date().toISOString() })
    .eq('tenant_id', input.tenantId)
    .eq('idempotency_key', input.idempotencyKey)
    .eq('channel', input.channel)
    .eq('owner_token', input.ownerToken)
    .in('state', input.fromStates)
    .select('channel')
    .maybeSingle();
  if (error) {
    console.error('[createTenantQuote] channel lease was not updated');
    return false;
  }
  return Boolean(data);
}

/** Stop waiting, but keep the lease so another instance cannot send yet. */
export async function markQuoteChannelUnknown(input: {
  admin: Admin;
  tenantId: string;
  idempotencyKey: string;
  channel: QuoteChannel;
  ownerToken: string;
}): Promise<boolean> {
  return writeLease({
    ...input,
    fromStates: ['sending'],
    patch: { state: 'unknown' },
  });
}

/** Record a finished provider call and release the lease. `failed` can be claimed again. */
export async function settleQuoteChannelSend(input: {
  admin: Admin;
  tenantId: string;
  idempotencyKey: string;
  channel: QuoteChannel;
  ownerToken: string;
  state: 'ok' | 'failed';
  nowMs: number;
}): Promise<boolean> {
  return writeLease({
    ...input,
    fromStates: ['sending', 'unknown'],
    patch: { state: input.state, lease_expires_at: new Date(input.nowMs).toISOString() },
  });
}
