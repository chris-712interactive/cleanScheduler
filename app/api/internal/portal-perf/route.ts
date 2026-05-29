import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function ingestEnabled(): boolean {
  return process.env.PORTAL_PERF_INGEST === '1' || process.env.NODE_ENV === 'development';
}

/** Accept client perf beacons (Web Vitals + interaction measures) for staging baselines. */
export async function POST(request: Request) {
  if (!ingestEnabled()) {
    return NextResponse.json({ error: 'Portal perf ingest disabled.' }, { status: 404 });
  }

  try {
    const body = await request.json();
    console.info('[portal-perf:ingest]', body);
    return new NextResponse(null, { status: 204 });
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
}
