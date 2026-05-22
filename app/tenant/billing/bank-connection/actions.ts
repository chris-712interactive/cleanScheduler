'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import {
  exchangeAndSaveBankLink,
  type PlaidLinkAccountMetadata,
  type PlaidLinkInstitutionMetadata,
} from '@/lib/plaid/exchangePublicToken';
import { tenantRoleError } from '@/lib/auth/tenantRoleAccess';
import { assertTenantFeatureEnabled, featureGateErrorMessage } from '@/lib/billing/tenantFeatureGate';
import { confirmPaymentMatchSuggestion, matchBankDepositToInvoice } from '@/lib/plaid/confirmPaymentMatch';
import { syncBankTransactionsForTenant } from '@/lib/plaid/syncBankTransactions';
import {
  createPlaidLinkToken,
  createPlaidUpdateLinkToken,
  getPlaidClient,
  isPlaidConfigured,
} from '@/lib/plaid/server';
import type { BankConnectionActionResult } from './finishBankConnectionAction';

function bankConnectionPath(): string {
  return '/billing/bank-connection';
}

function requireBankAdmin(membership: { role: import('@/lib/auth/types').TenantRole }): string | null {
  return tenantRoleError(membership.role, 'admin');
}

async function bankReconciliationGateError(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
): Promise<string | null> {
  try {
    await assertTenantFeatureEnabled(admin, tenantId, 'plaidReconciliation');
    return null;
  } catch (error) {
    return featureGateErrorMessage(error);
  }
}

export async function fetchPlaidLinkTokenAction(
  tenantSlug: string,
): Promise<{ link_token: string } | { error: string }> {
  await requirePortalAccess('tenant', '/billing/bank-connection');
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/bank-connection');
  const roleErr = requireBankAdmin(membership);
  if (roleErr) return { error: roleErr };

  const admin = createAdminClient();
  const tierErr = await bankReconciliationGateError(admin, membership.tenantId);
  if (tierErr) return { error: tierErr };

  if (!isPlaidConfigured()) {
    return { error: 'Plaid is not configured on this server.' };
  }

  const { data: link } = await admin
    .from('bank_links')
    .select('plaid_access_token, status')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  try {
    const linkToken =
      link?.plaid_access_token && link.status === 'login_required'
        ? await createPlaidUpdateLinkToken(membership.tenantId, link.plaid_access_token)
        : await createPlaidLinkToken(membership.tenantId);

    return { link_token: linkToken };
  } catch (e) {
    return {
      error: e instanceof Error ? e.message : 'Could not create Plaid link token.',
    };
  }
}

export async function connectBankFromPlaidAction(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const publicToken = String(formData.get('public_token') ?? '').trim();
  const accountJson = String(formData.get('account_json') ?? '').trim();
  const institutionJson = String(formData.get('institution_json') ?? '').trim();

  await requirePortalAccess('tenant', '/billing/bank-connection');
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/bank-connection');
  const roleErr = requireBankAdmin(membership);
  if (roleErr) return { error: roleErr };

  const admin = createAdminClient();
  const tierErr = await bankReconciliationGateError(admin, membership.tenantId);
  if (tierErr) return { error: tierErr };

  if (!isPlaidConfigured()) {
    return { error: 'Plaid is not configured on this server.' };
  }
  if (!publicToken || !accountJson) {
    return { error: 'Plaid did not return a public token.' };
  }

  let account: PlaidLinkAccountMetadata;
  let institution: PlaidLinkInstitutionMetadata | null = null;

  try {
    account = JSON.parse(accountJson) as PlaidLinkAccountMetadata;
    institution = institutionJson
      ? (JSON.parse(institutionJson) as PlaidLinkInstitutionMetadata)
      : null;
  } catch {
    return { error: 'Invalid Plaid account metadata.' };
  }

  try {
    await exchangeAndSaveBankLink(admin, membership.tenantId, publicToken, account, institution);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not connect bank account.' };
  }

  revalidatePath(bankConnectionPath());
  revalidatePath('/billing/transactions');
  return { ok: true };
}

export async function syncBankTransactionsAction(
  formData: FormData,
): Promise<BankConnectionActionResult> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  await requirePortalAccess('tenant', '/billing/bank-connection');
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/bank-connection');
  const roleErr = requireBankAdmin(membership);
  if (roleErr) return { error: roleErr };

  const admin = createAdminClient();
  const tierErr = await bankReconciliationGateError(admin, membership.tenantId);
  if (tierErr) return { error: tierErr };

  if (!isPlaidConfigured()) {
    return { error: 'Plaid is not configured on this server.' };
  }

  try {
    await syncBankTransactionsForTenant(admin, membership.tenantId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Bank sync failed.' };
  }

  revalidatePath(bankConnectionPath());
  return { ok: true };
}

export async function confirmPaymentMatchAction(
  formData: FormData,
): Promise<BankConnectionActionResult> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const suggestionId = String(formData.get('suggestion_id') ?? '').trim();

  await requirePortalAccess('tenant', '/billing/bank-connection');
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/bank-connection');
  const roleErr = requireBankAdmin(membership);
  if (roleErr) return { error: roleErr };

  if (!suggestionId) {
    return { error: 'Missing match suggestion.' };
  }

  const admin = createAdminClient();
  const tierErr = await bankReconciliationGateError(admin, membership.tenantId);
  if (tierErr) return { error: tierErr };

  try {
    await confirmPaymentMatchSuggestion(admin, membership.tenantId, suggestionId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not confirm match.' };
  }

  revalidatePath(bankConnectionPath());
  revalidatePath('/billing');
  revalidatePath('/billing/invoices');
  revalidatePath('/billing/transactions');
  revalidatePath('/billing/payment-audits');
  return { ok: true };
}

export async function dismissPaymentMatchAction(
  formData: FormData,
): Promise<BankConnectionActionResult> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const suggestionId = String(formData.get('suggestion_id') ?? '').trim();

  await requirePortalAccess('tenant', '/billing/bank-connection');
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/bank-connection');
  const roleErr = requireBankAdmin(membership);
  if (roleErr) return { error: roleErr };

  if (!suggestionId) {
    return { error: 'Missing match suggestion.' };
  }

  const admin = createAdminClient();
  const tierErr = await bankReconciliationGateError(admin, membership.tenantId);
  if (tierErr) return { error: tierErr };

  const { error } = await admin
    .from('payment_match_suggestions')
    .update({ status: 'dismissed' })
    .eq('id', suggestionId)
    .eq('tenant_id', membership.tenantId)
    .eq('status', 'suggested');

  if (error) {
    return { error: error.message };
  }

  revalidatePath(bankConnectionPath());
  return { ok: true };
}

export async function disconnectBankLinkAction(
  formData: FormData,
): Promise<BankConnectionActionResult> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  await requirePortalAccess('tenant', '/billing/bank-connection');
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/bank-connection');
  const roleErr = requireBankAdmin(membership);
  if (roleErr) return { error: roleErr };

  const admin = createAdminClient();
  const tierErr = await bankReconciliationGateError(admin, membership.tenantId);
  if (tierErr) return { error: tierErr };

  const { data: link } = await admin
    .from('bank_links')
    .select('id, plaid_access_token')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  if (!link) {
    return { error: 'No bank connection on file.' };
  }

  if (isPlaidConfigured()) {
    try {
      const client = getPlaidClient();
      await client.itemRemove({ access_token: link.plaid_access_token });
    } catch {
      // Still mark disconnected locally if Plaid item removal fails.
    }
  }

  const { error } = await admin
    .from('bank_links')
    .update({
      status: 'disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', link.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(bankConnectionPath());
  return { ok: true };
}

export async function manualMatchBankDepositAction(
  formData: FormData,
): Promise<BankConnectionActionResult> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const bankTransactionId = String(formData.get('bank_transaction_id') ?? '').trim();
  const invoiceId = String(formData.get('invoice_id') ?? '').trim();

  await requirePortalAccess('tenant', '/billing/bank-connection');
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/bank-connection');
  const roleErr = requireBankAdmin(membership);
  if (roleErr) return { error: roleErr };

  if (!bankTransactionId || !invoiceId) {
    return { error: 'Select an invoice to match.' };
  }

  const admin = createAdminClient();
  const tierErr = await bankReconciliationGateError(admin, membership.tenantId);
  if (tierErr) return { error: tierErr };

  try {
    await matchBankDepositToInvoice(admin, membership.tenantId, bankTransactionId, invoiceId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not match deposit.' };
  }

  revalidatePath(bankConnectionPath());
  revalidatePath('/billing');
  revalidatePath('/billing/invoices');
  revalidatePath('/billing/transactions');
  revalidatePath('/billing/payment-audits');
  return { ok: true };
}
