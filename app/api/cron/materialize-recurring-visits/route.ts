import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { materializeRecurringVisitsForAllTenants } from '@/lib/schedule/recurringVisitMaterialize';

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
    const result = await materializeRecurringVisitsForAllTenants();
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Materialize failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
