import { NextResponse } from 'next/server';
import { serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/server';
import { getStripe } from '@/lib/stripe/server';
import { backfillStripePayoutLinksForAllTenants } from '@/lib/stripe/backfillAllTenantPayouts';

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

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 501 });
  }

  try {
    const admin = createAdminClient();
    const result = await backfillStripePayoutLinksForAllTenants(admin, stripe);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Backfill failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
