import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { normalizeOutreachEmail } from '@/lib/admin/outreachTypes';
import { parseOutreachUnsubscribeToken } from '@/lib/admin/outreachUnsubscribeToken';
import { PRODUCT_NAME } from '@/lib/legal/site';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token')?.trim();
  if (!token) {
    return new NextResponse('Missing unsubscribe token.', { status: 400 });
  }

  const parsed = parseOutreachUnsubscribeToken(token);
  if (!parsed) {
    return new NextResponse('This unsubscribe link is invalid or expired.', { status: 400 });
  }

  const admin = createAdminClient();
  const emailNormalized = normalizeOutreachEmail(parsed.email);

  const { data: recipient } = await admin
    .from('platform_outreach_recipients')
    .select('id, campaign_id, email_normalized')
    .eq('id', parsed.recipientId)
    .maybeSingle();

  if (!recipient || recipient.email_normalized !== emailNormalized) {
    return new NextResponse('This unsubscribe link is invalid or expired.', { status: 400 });
  }

  const { error } = await admin.from('platform_outreach_suppressions').upsert(
    {
      email_normalized: emailNormalized,
      reason: 'unsubscribe',
      source: 'unsubscribe_link',
      campaign_id: recipient.campaign_id,
    },
    { onConflict: 'email_normalized' },
  );

  if (error) {
    return new NextResponse('Could not process your unsubscribe request.', { status: 500 });
  }

  const html = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Unsubscribed</title></head>
  <body style="font-family:sans-serif;padding:2rem;max-width:36rem;margin:0 auto;">
    <h1>You are unsubscribed</h1>
    <p>You will no longer receive outreach email from ${PRODUCT_NAME}.</p>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
