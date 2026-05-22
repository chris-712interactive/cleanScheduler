import { NextResponse } from 'next/server';
import { parseApiListParams, withTenantApiAuth } from '@/lib/integrations/tenantPublicApi';

export async function GET(request: Request) {
  return withTenantApiAuth(request, async ({ tenantId, admin }) => {
    const url = new URL(request.url);
    const { limit, offset } = parseApiListParams(url);
    const status = url.searchParams.get('status')?.trim();
    const from = url.searchParams.get('from')?.trim();
    const to = url.searchParams.get('to')?.trim();

    let query = admin
      .from('tenant_scheduled_visits')
      .select(
        'id, customer_id, quote_id, title, starts_at, ends_at, status, completed_at, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .order('starts_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status as 'scheduled' | 'completed' | 'cancelled');
    }
    if (from) {
      query = query.gte('starts_at', from);
    }
    if (to) {
      query = query.lte('starts_at', to);
    }

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: data ?? [],
      pagination: { limit, offset, total: count ?? 0 },
    });
  });
}
