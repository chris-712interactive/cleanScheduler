import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { processPendingCustomerPortalDomains } from '@/lib/portal/customerPortalDomainSync';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const secret = serverEnv.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 501 });
  }
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const result = await processPendingCustomerPortalDomains(admin);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Customer portal domain cron failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
