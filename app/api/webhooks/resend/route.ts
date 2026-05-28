import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { serverEnv, publicEnv } from '@/lib/env';
import {
  handleResendWebhookEvent,
  type ResendWebhookPayload,
} from '@/lib/campaigns/handleResendWebhook';
import { verifyResendWebhookSignature } from '@/lib/campaigns/verifyResendWebhook';
import type { Json } from '@/lib/supabase/database.types';

export async function POST(request: Request) {
  const rawBody = await request.text();

  const webhookSecret = serverEnv.RESEND_WEBHOOK_SECRET?.trim();
  if (webhookSecret) {
    const verified = verifyResendWebhookSignature({
      rawBody,
      webhookId: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
      secret: webhookSecret,
    });
    if (!verified) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }
  } else if (publicEnv.NEXT_PUBLIC_APP_ENV === 'prod') {
    console.warn('[resend webhook] RESEND_WEBHOOK_SECRET not set — accepting unsigned payload');
  }

  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventId = `${payload.type ?? 'unknown'}:${payload.data?.email_id ?? 'no-email'}:${payload.created_at ?? ''}`;
  const admin = createAdminClient();

  const { error: insertError } = await admin.from('resend_webhook_events').insert({
    resend_event_id: eventId,
    event_type: payload.type ?? 'unknown',
    payload: payload as unknown as Json,
  });

  if (insertError?.code === '23505') {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  try {
    await handleResendWebhookEvent(admin, payload);
  } catch (err) {
    await admin.from('resend_webhook_events').delete().eq('resend_event_id', eventId);
    const message = err instanceof Error ? err.message : 'Webhook handler failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
