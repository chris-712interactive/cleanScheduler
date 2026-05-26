import { NextResponse } from 'next/server';
import { handleSentWebhookEvent, verifySentWebhookRequest } from '@/lib/sms/handleSentWebhook';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = verifySentWebhookRequest({ rawBody, headers: request.headers });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: verified.status });
  }

  try {
    const admin = createAdminClient();
    await handleSentWebhookEvent(admin, rawBody);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler failed';
    console.error('[sent webhook]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
