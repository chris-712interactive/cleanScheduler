import { NextResponse } from 'next/server';
import { parseApiListParams, withTenantApiAuth } from '@/lib/integrations/tenantPublicApi';

export async function GET(request: Request) {
  return withTenantApiAuth(request, async ({ tenantId, admin }) => {
    const url = new URL(request.url);
    const { limit, offset } = parseApiListParams(url);
    const status = url.searchParams.get('status')?.trim();

    let query = admin
      .from('customers')
      .select(
        `
        id,
        external_ref,
        status,
        created_at,
        updated_at,
        customer_identities ( email, phone, full_name )
      `,
        { count: 'exact' },
      )
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const customers = (data ?? []).map((row) => {
      const identityRaw = row.customer_identities as
        | { email: string | null; phone: string | null; full_name: string | null }
        | { email: string | null; phone: string | null; full_name: string | null }[]
        | null;
      const identity = Array.isArray(identityRaw) ? identityRaw[0] : identityRaw;
      return {
        id: row.id,
        external_ref: row.external_ref,
        status: row.status,
        display_name: identity?.full_name ?? null,
        email: identity?.email ?? null,
        phone: identity?.phone ?? null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    return NextResponse.json({
      data: customers,
      pagination: { limit, offset, total: count ?? customers.length },
    });
  });
}
