'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { applyCustomerInvoicePromotions } from '@/lib/promotions/applyCustomerInvoicePromotions';

export type CustomerInvoicePromotionActionState = {
  error?: string;
  success?: boolean;
};

export async function applyCustomerInvoicePromotionsAction(
  _prev: CustomerInvoicePromotionActionState,
  formData: FormData,
): Promise<CustomerInvoicePromotionActionState> {
  const invoiceId = String(formData.get('invoice_id') ?? '').trim();
  if (!invoiceId) {
    return { error: 'Invalid request.' };
  }

  const auth = await requirePortalAccess('customer', `/invoices/${invoiceId}`);
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) {
    return { error: 'Account not found.' };
  }

  const admin = createAdminClient();
  const { data: invoice, error } = await admin
    .from('tenant_invoices')
    .select('id, tenant_id, customer_id, status')
    .eq('id', invoiceId)
    .maybeSingle();

  if (error || !invoice?.customer_id) {
    return { error: 'Invoice not found.' };
  }

  if (!ctx.customerIds.includes(invoice.customer_id)) {
    return { error: 'Invoice not found.' };
  }

  const result = await applyCustomerInvoicePromotions(admin, {
    tenantId: invoice.tenant_id as string,
    invoiceId,
    customerId: invoice.customer_id as string,
    rawPromoCode: String(formData.get('promo_code') ?? ''),
    rawWalletCreditDollars: String(formData.get('wallet_credit_dollars') ?? ''),
  });

  if (!result.ok) {
    return { error: result.error };
  }

  revalidatePath(`/invoices/${invoiceId}`, 'page');
  revalidatePath('/invoices', 'page');
  revalidatePath('/', 'page');
  revalidatePath('/referrals', 'page');

  return { success: true };
}
