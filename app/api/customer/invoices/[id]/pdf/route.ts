import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { buildInvoicePdfBuffer } from '@/lib/billing/buildInvoicePdfBuffer';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const auth = await requirePortalAccess('customer', `/invoices/${id}`);
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx?.customerIds.length) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: inv } = await admin
    .from('tenant_invoices')
    .select('id, tenant_id, customer_id, status')
    .eq('id', id)
    .maybeSingle();

  if (!inv || !ctx.customerIds.includes(inv.customer_id) || inv.status === 'void') {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  const pdf = await buildInvoicePdfBuffer(admin, {
    tenantId: inv.tenant_id,
    invoiceId: id,
  });

  if (!pdf) {
    return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  }

  return new NextResponse(Buffer.from(pdf.buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdf.filename}"`,
    },
  });
}
