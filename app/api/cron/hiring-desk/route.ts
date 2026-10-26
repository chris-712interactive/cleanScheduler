import { NextResponse } from 'next/server';
import { expireDueHolds, sendDueMorningReminders } from '@/lib/hiring/engine';
import { serverEnv } from '@/lib/env';
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
    const now = new Date();
    const expired = await expireDueHolds(admin, now);
    const reminded = await sendDueMorningReminders(admin, now);
    return NextResponse.json({ ...expired, ...reminded });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Hiring desk cron failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
