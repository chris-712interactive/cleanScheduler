import { NextResponse } from 'next/server';
import { processOutreachSendBatch } from '@/lib/admin/processOutreachSendBatch';
import { serverEnv } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
    const result = await processOutreachSendBatch(admin);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Outreach send batch failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
