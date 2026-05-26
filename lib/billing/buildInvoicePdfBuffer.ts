import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { customerLabelFromIdentity } from '@/lib/reports/customerLabel';
import { renderInvoicePdf } from '@/lib/billing/renderInvoicePdf';

type Admin = SupabaseClient<Database>;

export async function buildInvoicePdfBuffer(
  admin: Admin,
  params: { tenantId: string; invoiceId: string },
): Promise<{ buffer: Buffer; filename: string } | null> {
  const { data: inv } = await admin
    .from('tenant_invoices')
    .select(
      `
      id,
      title,
      status,
      amount_cents,
      amount_paid_cents,
      due_date,
      notes,
      created_at,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name
        )
      )
    `,
    )
    .eq('tenant_id', params.tenantId)
    .eq('id', params.invoiceId)
    .maybeSingle();

  if (!inv) return null;

  const { data: tenant } = await admin
    .from('tenants')
    .select('name, slug')
    .eq('id', params.tenantId)
    .maybeSingle();

  const { data: payments } = await admin
    .from('tenant_invoice_payments')
    .select('amount_cents, method, recorded_at, notes')
    .eq('invoice_id', params.invoiceId)
    .order('recorded_at', { ascending: true });

  const ident = inv.customers?.customer_identities ?? null;
  const buffer = await renderInvoicePdf({
    tenantName: tenant?.name?.trim() || tenant?.slug || 'Workspace',
    invoiceTitle: inv.title,
    status: inv.status,
    customerLabel: customerLabelFromIdentity(ident),
    amountCents: inv.amount_cents,
    amountPaidCents: inv.amount_paid_cents,
    dueDate: inv.due_date,
    notes: inv.notes,
    createdAt: inv.created_at,
    payments: (payments ?? []).map((p) => ({
      amountCents: p.amount_cents,
      method: p.method,
      recordedAt: p.recorded_at,
      notes: p.notes,
    })),
  });

  const safeTitle = inv.title.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'invoice';
  return { buffer, filename: `${safeTitle}-${inv.id.slice(0, 8)}.pdf` };
}
