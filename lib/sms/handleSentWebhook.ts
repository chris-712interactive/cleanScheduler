import type { SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from '@/lib/env';
import type { Database } from '@/lib/supabase/database.types';
import { verifySentWebhookSignature } from '@/lib/sms/verifySentWebhook';

export type SentWebhookDeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'read';

type SentWebhookPayload = {
  field?: string;
  sub_type?: string;
  payload?: {
    message_id?: string;
    message_status?: string;
    status?: string;
  };
};

export function verifySentWebhookRequest(params: {
  rawBody: string;
  headers: Headers;
}): { ok: true } | { ok: false; status: number; error: string } {
  const secret = serverEnv.SENT_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return { ok: false, status: 501, error: 'SENT_WEBHOOK_SECRET is not configured.' };
  }

  const valid = verifySentWebhookSignature({
    rawBody: params.rawBody,
    signature: params.headers.get('x-webhook-signature'),
    webhookId: params.headers.get('x-webhook-id'),
    timestamp: params.headers.get('x-webhook-timestamp'),
    secret,
  });

  if (!valid) {
    return { ok: false, status: 401, error: 'Invalid webhook signature.' };
  }

  return { ok: true };
}

export async function handleSentWebhookEvent(
  admin: SupabaseClient<Database>,
  rawBody: string,
): Promise<void> {
  let event: SentWebhookPayload;
  try {
    event = JSON.parse(rawBody) as SentWebhookPayload;
  } catch {
    throw new Error('Invalid webhook JSON.');
  }

  if (event.field !== 'message') return;
  if (event.sub_type === 'message.received') return;

  const messageId = event.payload?.message_id?.trim();
  if (!messageId) return;

  const rawStatus = (event.payload?.message_status ?? event.payload?.status ?? '').trim();
  const deliveryStatus = mapSentMessageStatus(rawStatus);
  if (!deliveryStatus) return;

  const { error } = await admin
    .from('tenant_sms_messages')
    .update({ delivery_status: deliveryStatus })
    .eq('provider_message_id', messageId);

  if (error) {
    throw new Error(error.message);
  }
}

function mapSentMessageStatus(raw: string): SentWebhookDeliveryStatus | null {
  const normalized = raw.toUpperCase();
  switch (normalized) {
    case 'QUEUED':
      return 'queued';
    case 'ROUTED':
    case 'PROCESSED':
    case 'SENT':
      return 'sent';
    case 'DELIVERED':
      return 'delivered';
    case 'READ':
      return 'read';
    case 'FAILED':
      return 'failed';
    default:
      return null;
  }
}
