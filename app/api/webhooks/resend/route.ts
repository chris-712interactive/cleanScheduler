import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { handleResendWebhookEvent, type ResendWebhookPayload } from '@/lib/campaigns/handleResendWebhook';
import type { Json } from '@/lib/supabase/database.types';

export async function POST(request: Request) {
  let payload: ResendWebhookPayload;
  try {
    payload = (await request.json()) as ResendWebhookPayload;
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
