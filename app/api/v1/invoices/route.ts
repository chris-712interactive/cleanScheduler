import { NextResponse } from 'next/server';
import { parseApiListParams, withTenantApiAuth } from '@/lib/integrations/tenantPublicApi';

export async function GET(request: Request) {
  return withTenantApiAuth(request, async ({ tenantId, admin }) => {
    const url = new URL(request.url);
    const { limit, offset } = parseApiListParams(url);
    const status = url.searchParams.get('status')?.trim();

    let query = admin
      .from('tenant_invoices')
      .select(
        'id, customer_id, visit_id, title, status, currency, amount_cents, amount_paid_cents, due_date, created_at, updated_at',
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status as 'draft' | 'open' | 'paid' | 'void');
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
