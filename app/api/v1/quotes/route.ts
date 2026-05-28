import { NextResponse } from 'next/server';
import { parseApiListParams, withTenantApiAuth } from '@/lib/integrations/tenantPublicApi';

export async function GET(request: Request) {
  return withTenantApiAuth(request, async ({ tenantId, admin }) => {
    const url = new URL(request.url);
    const { limit, offset } = parseApiListParams(url);
    const status = url.searchParams.get('status')?.trim();

    let query = admin
      .from('tenant_quotes')
      .select(
        'id, customer_id, title, status, amount_cents, currency, valid_until, accepted_at, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status as 'draft' | 'sent' | 'accepted' | 'declined' | 'expired');
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
