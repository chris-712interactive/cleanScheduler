import { NextResponse } from 'next/server';
import { buildDeploymentIdentity } from '@/lib/hosted-dev/deploymentIdentity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Public, non-secret deployment identity for hosted-dev checks. */
export function GET() {
  return NextResponse.json(buildDeploymentIdentity(process.env), {
    headers: {
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}
