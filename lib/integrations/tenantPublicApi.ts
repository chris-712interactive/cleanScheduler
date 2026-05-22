import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { authenticateTenantApiRequest } from '@/lib/integrations/authenticateTenantApiRequest';

export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export function parseApiListParams(url: URL): { limit: number; offset: number } {
  const limitRaw = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
  const offsetRaw = Number(url.searchParams.get('offset') ?? 0);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(1, Math.floor(limitRaw)), MAX_LIMIT)
    : DEFAULT_LIMIT;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;
  return { limit, offset };
}

export async function withTenantApiAuth(
  request: Request,
  handler: (ctx: { tenantId: string; admin: ReturnType<typeof createAdminClient> }) => Promise<Response>,
): Promise<Response> {
  const admin = createAdminClient();
  const auth = await authenticateTenantApiRequest(admin, request);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    return await handler({ tenantId: auth.tenantId, admin });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
