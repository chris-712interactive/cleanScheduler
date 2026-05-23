import type { SupabaseClient } from '@supabase/supabase-js';
import type { TenantRole } from '@/lib/auth/types';
import type { Database } from '@/lib/supabase/database.types';
import { parseCentsFromDollars } from '@/lib/billing/parseMoney';
import {
  FIELD_EMPLOYEE_NO_PRICE_MESSAGE,
  positiveAmountCents,
  resolveVisitExpectedAmountCents,
} from '@/lib/billing/resolveVisitExpectedAmount';
import { sendTenantInvoiceEmailForInvoice } from '@/lib/billing/sendTenantInvoiceEmail';
import { afterInvoicePaymentRecorded } from '@/lib/integrations/emitInvoiceWebhook';
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

function parseBillingAmountCents(
  amountDollars: string,
  expectedAmountCents: number | null,
  options: { allowFormOverride: boolean },
): number | null {
  if (options.allowFormOverride) {
    const fromForm = parseCentsFromDollars(amountDollars);
    if (fromForm != null && fromForm > 0) return fromForm;
  }
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
    billing: CompleteVisitBillingInput;
  },
): Promise<{ invoiceId: string; emailed: boolean; amountCents: number } | { error: string }> {
  const expectedAmountCents = await resolveVisitExpectedAmountCents(admin, {
    tenantId: params.tenantId,
    expectedAmountCents: params.expectedAmountCents,
    quoteId: params.quoteId,
  });

  if (isFieldEmployeeRole(params.actorRole) && expectedAmountCents == null) {
    return { error: FIELD_EMPLOYEE_NO_PRICE_MESSAGE };
  }

  const amountCents = parseBillingAmountCents(params.billing.amountDollars, expectedAmountCents, {
    allowFormOverride: !isFieldEmployeeRole(params.actorRole),
  });

  if (amountCents == null || amountCents <= 0) {
    return {
      error: isFieldEmployeeRole(params.actorRole)
        ? FIELD_EMPLOYEE_NO_PRICE_MESSAGE
        : 'Enter the job amount to bill.',
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

    const notes =
      method === 'check'
        ? `Check #${params.billing.checkNumber?.trim()} (collected at job completion)`
        : 'Collected at job completion';

    const { error: payErr } = await admin.from('tenant_invoice_payments').insert({
      tenant_id: params.tenantId,
      invoice_id: created.invoiceId,
      amount_cents: amountCents,
      method: method as PaymentMethod,
      notes,
    });

    if (payErr) {
      return { error: payErr.message };
    }

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
