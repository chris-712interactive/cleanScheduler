import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { parseCampaignUnsubscribeToken } from '@/lib/campaigns/unsubscribeToken';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token')?.trim();
  if (!token) {
    return new NextResponse('Missing unsubscribe token.', { status: 400 });
  }

  const parsed = parseCampaignUnsubscribeToken(token);
  if (!parsed) {
    return new NextResponse('This unsubscribe link is invalid or expired.', { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from('tenant_email_suppressions').upsert(
    {
      tenant_id: parsed.tenantId,
      email_normalized: parsed.email.toLowerCase(),
      reason: 'unsubscribe',
      source: 'unsubscribe_link',
    },
    { onConflict: 'tenant_id,email_normalized' },
  );

  if (error) {
    return new NextResponse('Could not process your unsubscribe request.', { status: 500 });
  }

  await admin
    .from('tenant_customer_profiles')
    .update({ marketing_email_opt_in: false, updated_at: new Date().toISOString() })
    .eq('tenant_id', parsed.tenantId)
    .eq('customer_id', parsed.customerId);

  const html = `<!DOCTYPE html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Unsubscribed</title></head>
  <body style="font-family:sans-serif;padding:2rem;max-width:36rem;margin:0 auto;">
    <h1>You are unsubscribed</h1>
    <p>You will no longer receive promotional email from this business. Transactional messages about quotes, invoices, and appointments may still arrive when relevant.</p>
  </body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
