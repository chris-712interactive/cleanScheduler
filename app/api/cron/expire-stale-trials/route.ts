import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { serverEnv } from '@/lib/env';
import { expireStaleDbOnlyTrials } from '@/lib/billing/expireStaleTrials';

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
    const result = await expireStaleDbOnlyTrials(admin);
    return NextResponse.json({
      ok: true,
      expiredCount: result.expiredTenantIds.length,
      expiredTenantIds: result.expiredTenantIds,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Expire trials failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
