import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantRole } from '@/lib/auth/types';
import type { Database } from '@/lib/supabase/database.types';
import {
  FIELD_EMPLOYEE_NO_PRICE_MESSAGE,
  OFFICE_NO_PRICE_MESSAGE,
  positiveAmountCents,
  resolveVisitExpectedAmountCents,
} from '@/lib/billing/resolveVisitExpectedAmount';
import { sendTenantInvoiceEmailForInvoice } from '@/lib/billing/sendTenantInvoiceEmail';
import { afterInvoicePaymentRecorded } from '@/lib/integrations/emitInvoiceWebhook';
import { recordTenantPaymentEvent } from '@/lib/audit/recordTenantPaymentEvent';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';

type AdminClient = SupabaseClient<Database>;
type PaymentMethod = Database['public']['Enums']['tenant_payment_method'];

export interface CompleteVisitBillingInput {
  paymentCollected: boolean;
  collectedMethod?: 'cash' | 'check';
  checkNumber?: string;
  amountDollars: string;
}

/** @deprecated Use resolveVisitExpectedAmountCents — kept for callers loading quote only. */
export async function resolveVisitBillingAmountCents(
  admin: AdminClient,
  quoteId: string | null,
): Promise<number | null> {
  if (!quoteId) return null;
  const { data: quote } = await admin
    .from('tenant_quotes')
    .select('amount_cents')
    .eq('id', quoteId)
    .maybeSingle();
  return positiveAmountCents(quote?.amount_cents);
}

function resolveCompletionAmountCents(expectedAmountCents: number | null): number | null {
  if (expectedAmountCents != null && expectedAmountCents > 0) return expectedAmountCents;
  return null;
}

async function createVisitInvoice(
  admin: AdminClient,
  params: {
    tenantId: string;
    customerId: string;
    visitId: string;
    title: string;
    amountCents: number;
  },
): Promise<{ invoiceId: string } | { error: string }> {
  const { data, error } = await admin
    .from('tenant_invoices')
    .insert({
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      visit_id: params.visitId,
      title: params.title,
      status: 'open',
      amount_cents: params.amountCents,
      amount_paid_cents: 0,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { error: error?.message ?? 'Could not create invoice.' };
  }
  return { invoiceId: data.id };
}

export async function applyVisitCompletionBilling(
  admin: AdminClient,
  params: {
    tenantId: string;
    tenantSlug: string;
    visitId: string;
    customerId: string;
    quoteId: string | null;
    expectedAmountCents: number | null;
    visitTitle: string;
    actorRole: TenantRole;
    actorUserId?: string | null;
    billing: CompleteVisitBillingInput;
  },
): Promise<{ invoiceId: string; emailed: boolean; amountCents: number } | { error: string }> {
  const expectedAmountCents = await resolveVisitExpectedAmountCents(admin, {
    tenantId: params.tenantId,
    expectedAmountCents: params.expectedAmountCents,
    quoteId: params.quoteId,
  });

  if (expectedAmountCents == null) {
    return {
      error: isFieldEmployeeRole(params.actorRole)
        ? FIELD_EMPLOYEE_NO_PRICE_MESSAGE
        : OFFICE_NO_PRICE_MESSAGE,
    };
  }

  const amountCents = resolveCompletionAmountCents(expectedAmountCents);

  if (amountCents == null || amountCents <= 0) {
    return {
      error: isFieldEmployeeRole(params.actorRole)
        ? FIELD_EMPLOYEE_NO_PRICE_MESSAGE
        : OFFICE_NO_PRICE_MESSAGE,
    };
  }

  const invoiceTitle = params.visitTitle.trim() || 'Service visit';

  if (params.billing.paymentCollected) {
    const method = params.billing.collectedMethod;
    if (method !== 'cash' && method !== 'check') {
      return { error: 'Select cash or check for on-site payment.' };
    }
    if (method === 'check') {
      const checkNumber = params.billing.checkNumber?.trim() ?? '';
      if (!checkNumber) {
        return { error: 'Check number is required.' };
      }
    }

    const created = await createVisitInvoice(admin, {
      tenantId: params.tenantId,
      customerId: params.customerId,
      visitId: params.visitId,
      title: invoiceTitle,
      amountCents,
    });
    if ('error' in created) return created;

    const checkNumber = params.billing.checkNumber?.trim() ?? '';
    const notes =
      method === 'check'
        ? `Check #${checkNumber} (collected at job completion)`
        : 'Collected at job completion';

    const now = new Date().toISOString();
    const { data: paymentRow, error: payErr } = await admin
      .from('tenant_invoice_payments')
      .insert({
        tenant_id: params.tenantId,
        invoice_id: created.invoiceId,
        amount_cents: amountCents,
        method: method as PaymentMethod,
        notes,
        check_number: method === 'check' ? checkNumber : null,
        received_at: now,
        received_by_user_id: params.actorUserId ?? null,
      })
      .select('id')
      .single();

    if (payErr || !paymentRow) {
      return { error: payErr?.message ?? 'Could not record payment.' };
    }

    await recordTenantPaymentEvent(admin, {
      tenantId: params.tenantId,
      paymentId: paymentRow.id,
      invoiceId: created.invoiceId,
      actorUserId: params.actorUserId ?? null,
      action: 'payment.received',
      detail: `${method} collected in the field`,
    });

    await afterInvoicePaymentRecorded(admin, {
      tenantId: params.tenantId,
      invoiceId: created.invoiceId,
    });

    return { invoiceId: created.invoiceId, emailed: false, amountCents };
  }

  const created = await createVisitInvoice(admin, {
    tenantId: params.tenantId,
    customerId: params.customerId,
    visitId: params.visitId,
    title: invoiceTitle,
    amountCents,
  });
  if ('error' in created) return created;

  const sent = await sendTenantInvoiceEmailForInvoice(admin, {
    tenantId: params.tenantId,
    tenantSlug: params.tenantSlug,
    invoiceId: created.invoiceId,
  });

  if (!sent.ok) {
    return { error: sent.error };
  }

  return { invoiceId: created.invoiceId, emailed: true, amountCents };
}
