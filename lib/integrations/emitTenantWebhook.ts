import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/lib/supabase/database.types';
import { buildWebhookSignatureHeader } from '@/lib/integrations/integrationSecrets';
import {
  endpointSubscribesToEvent,
  type TenantWebhookEventType,
} from '@/lib/integrations/tenantWebhookEvents';

const MAX_RESPONSE_PREVIEW = 500;
const MAX_ATTEMPTS = 5;

export function truncateWebhookResponsePreview(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= MAX_RESPONSE_PREVIEW) return trimmed;
  return `${trimmed.slice(0, MAX_RESPONSE_PREVIEW)}…`;
}

function retryDelayMs(attemptCount: number): number {
  const base = 60_000;
  return Math.min(base * 2 ** Math.max(0, attemptCount - 1), 60 * 60 * 1000);
}

export async function emitTenantWebhook(params: {
  admin: SupabaseClient<Database>;
  tenantId: string;
  eventType: TenantWebhookEventType;
  data: Record<string, unknown>;
}): Promise<void> {
  const eventId = crypto.randomUUID();
  const envelope = {
    id: eventId,
    type: params.eventType,
    created_at: new Date().toISOString(),
    data: params.data,
  };

  const { data: endpoints, error } = await params.admin
    .from('tenant_webhook_endpoints')
    .select('id, event_types')
    .eq('tenant_id', params.tenantId)
    .eq('enabled', true);

  if (error) {
    console.error('[webhooks] load endpoints failed:', error.message);
    return;
  }

  const matching = (endpoints ?? []).filter((endpoint) =>
    endpointSubscribesToEvent(endpoint.event_types ?? [], params.eventType),
  );

  if (matching.length === 0) return;

  for (const endpoint of matching) {
    const { data: delivery, error: insertErr } = await params.admin
      .from('tenant_webhook_deliveries')
      .insert({
        tenant_id: params.tenantId,
        endpoint_id: endpoint.id,
        event_type: params.eventType,
        event_id: eventId,
        payload: envelope as Json,
        status: 'pending',
      })
      .select('id')
      .maybeSingle();

    if (insertErr) {
      if (/duplicate key|unique constraint/i.test(insertErr.message)) continue;
      console.error('[webhooks] enqueue failed:', insertErr.message);
      continue;
    }

    if (delivery?.id) {
      void deliverTenantWebhookById(params.admin, delivery.id).catch((err) => {
        console.error('[webhooks] immediate delivery failed:', err);
      });
    }
  }
}

export async function deliverTenantWebhookById(
  admin: SupabaseClient<Database>,
  deliveryId: string,
): Promise<'delivered' | 'failed' | 'skipped'> {
  const { data: delivery, error } = await admin
    .from('tenant_webhook_deliveries')
    .select(
      `
      id,
      tenant_id,
      endpoint_id,
      payload,
      status,
      attempt_count,
      tenant_webhook_endpoints ( url, signing_secret, enabled )
    `,
    )
    .eq('id', deliveryId)
    .maybeSingle();

  if (error || !delivery) {
    throw new Error(error?.message ?? 'Delivery not found');
  }

  if (delivery.status === 'delivered') return 'skipped';

  const endpointRaw = delivery.tenant_webhook_endpoints as
    | { url: string; signing_secret: string; enabled: boolean }
    | { url: string; signing_secret: string; enabled: boolean }[]
    | null;
  const endpoint = Array.isArray(endpointRaw) ? endpointRaw[0] : endpointRaw;

  if (!endpoint?.enabled || !endpoint.url) {
    await admin
      .from('tenant_webhook_deliveries')
      .update({
        status: 'failed',
        error_message: 'Webhook endpoint disabled or missing.',
      })
      .eq('id', deliveryId);
    return 'failed';
  }

  const attemptCount = (delivery.attempt_count ?? 0) + 1;
  const body = JSON.stringify(delivery.payload);
  const signature = buildWebhookSignatureHeader(endpoint.signing_secret, body);

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'cleanScheduler-Webhooks/1.0',
        'X-CleanScheduler-Signature': signature,
      },
      body,
      signal: AbortSignal.timeout(15_000),
    });

    const responseText = truncateWebhookResponsePreview(await response.text());

    if (response.ok) {
      await admin
        .from('tenant_webhook_deliveries')
        .update({
          status: 'delivered',
          attempt_count: attemptCount,
          http_status: response.status,
          response_body_preview: responseText || null,
          delivered_at: new Date().toISOString(),
          next_retry_at: null,
          error_message: null,
        })
        .eq('id', deliveryId);
      return 'delivered';
    }

    const retry = attemptCount < MAX_ATTEMPTS;
    await admin
      .from('tenant_webhook_deliveries')
      .update({
        status: retry ? 'pending' : 'failed',
        attempt_count: attemptCount,
        http_status: response.status,
        response_body_preview: responseText || null,
        error_message: `HTTP ${response.status}`,
        next_retry_at: retry
          ? new Date(Date.now() + retryDelayMs(attemptCount)).toISOString()
          : null,
      })
      .eq('id', deliveryId);
    return retry ? 'failed' : 'failed';
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook delivery failed';
    const retry = attemptCount < MAX_ATTEMPTS;
    await admin
      .from('tenant_webhook_deliveries')
      .update({
        status: retry ? 'pending' : 'failed',
        attempt_count: attemptCount,
        error_message: message,
        next_retry_at: retry
          ? new Date(Date.now() + retryDelayMs(attemptCount)).toISOString()
          : null,
      })
      .eq('id', deliveryId);
    return 'failed';
  }
}

export async function processPendingTenantWebhookDeliveries(
  admin: SupabaseClient<Database>,
  limit = 50,
): Promise<{ processed: number; delivered: number; failed: number }> {
  const now = new Date().toISOString();
  const { data: pending, error } = await admin
    .from('tenant_webhook_deliveries')
    .select('id')
    .eq('status', 'pending')
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  let delivered = 0;
  let failed = 0;

  for (const row of pending ?? []) {
    const result = await deliverTenantWebhookById(admin, row.id);
    if (result === 'delivered') delivered += 1;
    else if (result === 'failed') failed += 1;
  }

  return { processed: pending?.length ?? 0, delivered, failed };
}
