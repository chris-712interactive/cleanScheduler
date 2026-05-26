import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { buildInvoicePdfBuffer } from '@/lib/billing/buildInvoicePdfBuffer';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const { tenantSlug } = await getPortalContext();
  if (!tenantSlug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const membership = await requireTenantPortalAccess(tenantSlug, `/billing/invoices/${id}`);
  const admin = createAdminClient();
  const pdf = await buildInvoicePdfBuffer(admin, {
    tenantId: membership.tenantId,
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
