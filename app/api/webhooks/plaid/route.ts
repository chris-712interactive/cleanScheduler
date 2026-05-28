import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { isPlaidConfigured } from '@/lib/plaid/server';
import { syncBankTransactionsForTenant } from '@/lib/plaid/syncBankTransactions';
import { verifyPlaidWebhook } from '@/lib/plaid/verifyPlaidWebhook';

export const dynamic = 'force-dynamic';

interface PlaidWebhookBody {
  webhook_type?: string;
  webhook_code?: string;
  item_id?: string;
}

export async function POST(request: Request) {
  if (!isPlaidConfigured()) {
    return NextResponse.json({ error: 'Plaid is not configured' }, { status: 501 });
  }

  const verification = request.headers.get('plaid-verification');
  const rawBody = await request.text();

  let body: PlaidWebhookBody;
  try {
    const parsed = await verifyPlaidWebhook<Record<string, unknown>>(rawBody, verification);
    body = parsed as PlaidWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const itemId = body.item_id?.trim();
  if (!itemId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const admin = createAdminClient();

  if (body.webhook_type === 'TRANSACTIONS' && body.webhook_code === 'SYNC_UPDATES_AVAILABLE') {
    const { data: link } = await admin
      .from('bank_links')
      .select('tenant_id, status')
      .eq('plaid_item_id', itemId)
      .maybeSingle();

    if (link?.status === 'active') {
      try {
        await syncBankTransactionsForTenant(admin, link.tenant_id);
      } catch {
        return NextResponse.json({ ok: false }, { status: 500 });
      }
    }
  }

  if (body.webhook_type === 'ITEM' && body.webhook_code === 'ITEM_LOGIN_REQUIRED') {
    await admin
      .from('bank_links')
      .update({
        status: 'login_required',
        updated_at: new Date().toISOString(),
      })
      .eq('plaid_item_id', itemId);
  }

  return NextResponse.json({ ok: true });
}
