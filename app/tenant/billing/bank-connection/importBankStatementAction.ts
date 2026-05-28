'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageBankReconciliation } from '@/lib/auth/tenantRoleAccess';
import { getAuthContext } from '@/lib/auth/session';
import {
  assertTenantFeatureEnabled,
  featureGateErrorMessage,
} from '@/lib/billing/tenantFeatureGate';
import { importBankStatementRows } from '@/lib/plaid/importBankStatement';
import { parseBankStatementCsv } from '@/lib/plaid/parseBankStatementCsv';

export async function importBankStatementAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/bank-connection');

  if (!canManageBankReconciliation(membership.role)) {
    redirect('/billing/bank-connection?error=Admin access required to import bank statements.');
  }

  const admin = createAdminClient();
  try {
    await assertTenantFeatureEnabled(admin, membership.tenantId, 'plaidReconciliation');
  } catch (error) {
    const message =
      featureGateErrorMessage(error) ?? 'Upgrade your subscription to import bank statements.';
    redirect(`/billing/bank-connection?error=${encodeURIComponent(message)}`);
  }

  const file = formData.get('statement_file');
  if (!(file instanceof File) || file.size === 0) {
    redirect('/billing/bank-connection?error=Choose a CSV file to import.');
  }

  if (file.size > 2 * 1024 * 1024) {
    redirect('/billing/bank-connection?error=CSV must be 2 MB or smaller.');
  }

  const text = await file.text();
  const parsed = parseBankStatementCsv(text);
  if (parsed.error) {
    redirect(`/billing/bank-connection?error=${encodeURIComponent(parsed.error)}`);
  }

  const auth = await getAuthContext();
  const result = await importBankStatementRows(
    admin,
    membership.tenantId,
    parsed.rows,
    auth?.user.id ?? null,
  );

  if (result.error) {
    redirect(`/billing/bank-connection?error=${encodeURIComponent(result.error)}`);
  }

  revalidatePath('/billing/bank-connection');
  revalidatePath('/reports/bank-reconciliation');
  redirect(`/billing/bank-connection?imported=${result.imported}&skipped=${result.skipped}`);
}
