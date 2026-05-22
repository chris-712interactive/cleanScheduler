import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertWhiteLabelCustomerPortalAllowed,
  whiteLabelPortalGateErrorMessage,
} from '@/lib/billing/whiteLabelPortalGate';
import { verifyCustomerPortalDomainTxt } from '@/lib/portal/customerPortalDnsVerify';
import { customerPortalVerificationRecordName } from '@/lib/portal/customerPortalHostname';
import {
  getVercelProjectDomain,
  isVercelDomainAutomationConfigured,
  vercelDomainErrorMessage,
  verifyVercelProjectDomain,
} from '@/lib/portal/vercelProjectDomains';
import {
  processPendingSupabaseAuthRedirects,
  recordCustomerPortalDomainActivation,
} from '@/lib/portal/customerPortalDomainActivation';
import { publicEnv } from '@/lib/env';
import type { Database, Json } from '@/lib/supabase/database.types';

export type CustomerPortalDomainSyncOutcome =
  | { status: 'missing' }
  | { status: 'already_active'; hostname: string }
  | { status: 'activated'; hostname: string }
  | { status: 'pending'; hostname: string; hint?: string }
  | { status: 'skipped'; hostname: string; reason: string }
  | { status: 'error'; hostname: string; message: string };

export interface PendingCustomerPortalDomainProcessResult {
  scanned: number;
  activated: number;
  stillPending: number;
  skipped: number;
  errors: number;
  vercelConfigured: boolean;
  authRedirectsScanned: number;
  authRedirectsRegistered: number;
  authRedirectErrors: number;
}

type PendingDomainRow = {
  tenant_id: string;
  hostname: string;
  status: string;
  verification_token: string | null;
};

function pendingHintMessage(
  hostname: string,
  hint?: { type: string; domain: string; value: string },
): string | undefined {
  if (!hint) return undefined;
  return `Add a ${hint.type} record for ${hint.domain} with value ${hint.value}.`;
}

async function tenantEligibleForWhiteLabel(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    await assertWhiteLabelCustomerPortalAllowed(admin, tenantId);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      reason: whiteLabelPortalGateErrorMessage(error) ?? 'Workspace not eligible for white-label portal.',
    };
  }
}

/** Poll DNS (Vercel or local TXT) and activate the tenant hostname when verified. */
export async function syncCustomerPortalDomainVerification(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<CustomerPortalDomainSyncOutcome> {
  const { data: row, error: rowErr } = await admin
    .from('tenant_customer_portal_domains')
    .select('hostname, status, verification_token')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (rowErr) {
    return { status: 'error', hostname: '', message: rowErr.message };
  }
  if (!row) {
    return { status: 'missing' };
  }
  if (row.status === 'active') {
    return { status: 'already_active', hostname: row.hostname };
  }

  const eligibility = await tenantEligibleForWhiteLabel(admin, tenantId);
  if (!eligibility.ok) {
    return { status: 'skipped', hostname: row.hostname, reason: eligibility.reason };
  }

  if (isVercelDomainAutomationConfigured()) {
    return syncViaVercel(admin, tenantId, row.hostname);
  }

  if (publicEnv.NEXT_PUBLIC_APP_ENV === 'local') {
    return syncViaLocalTxt(admin, tenantId, row);
  }

  return {
    status: 'skipped',
    hostname: row.hostname,
    reason: 'Vercel domain automation is not configured.',
  };
}

async function syncViaVercel(
  admin: SupabaseClient<Database>,
  tenantId: string,
  hostname: string,
): Promise<CustomerPortalDomainSyncOutcome> {
  let vercelDomain;
  try {
    vercelDomain = await verifyVercelProjectDomain(hostname);
  } catch (error) {
    const message = vercelDomainErrorMessage(error) ?? 'Could not verify domain with Vercel.';
    await admin
      .from('tenant_customer_portal_domains')
      .update({
        vercel_last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);
    return { status: 'error', hostname, message };
  }

  if (!vercelDomain.verified) {
    try {
      vercelDomain = await getVercelProjectDomain(hostname);
    } catch {
      // Keep verify response when refresh fails.
    }

    await admin
      .from('tenant_customer_portal_domains')
      .update({
        vercel_verification: vercelDomain.verification as unknown as Json,
        vercel_last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    const hint = vercelDomain.verification[0];
    return {
      status: 'pending',
      hostname,
      hint: pendingHintMessage(hostname, hint),
    };
  }

  try {
    await recordCustomerPortalDomainActivation(admin, tenantId, {
      hostname,
      vercelVerification: vercelDomain.verification,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not activate domain.';
    return { status: 'error', hostname, message };
  }

  return { status: 'activated', hostname };
}

async function syncViaLocalTxt(
  admin: SupabaseClient<Database>,
  tenantId: string,
  row: Pick<PendingDomainRow, 'hostname' | 'verification_token'>,
): Promise<CustomerPortalDomainSyncOutcome> {
  if (!row.verification_token) {
    return {
      status: 'error',
      hostname: row.hostname,
      message: 'Verification token is missing. Save the domain again.',
    };
  }

  const verified = await verifyCustomerPortalDomainTxt(row.hostname, row.verification_token);
  if (!verified) {
    return {
      status: 'pending',
      hostname: row.hostname,
      hint: `Add TXT at ${customerPortalVerificationRecordName(row.hostname)} with value ${row.verification_token}.`,
    };
  }

  try {
    await recordCustomerPortalDomainActivation(admin, tenantId, { hostname: row.hostname });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not activate domain.';
    return { status: 'error', hostname: row.hostname, message };
  }

  return { status: 'activated', hostname: row.hostname };
}

/** Cron entrypoint — re-check every pending white-label hostname. */
export async function processPendingCustomerPortalDomains(
  admin: SupabaseClient<Database>,
): Promise<PendingCustomerPortalDomainProcessResult> {
  const vercelConfigured = isVercelDomainAutomationConfigured();
  const localFallback = publicEnv.NEXT_PUBLIC_APP_ENV === 'local';

  if (!vercelConfigured && !localFallback) {
    const authRedirectResult = await processPendingSupabaseAuthRedirects(admin);
    return {
      scanned: 0,
      activated: 0,
      stillPending: 0,
      skipped: 0,
      errors: 0,
      vercelConfigured: false,
      authRedirectsScanned: authRedirectResult.scanned,
      authRedirectsRegistered: authRedirectResult.registered,
      authRedirectErrors: authRedirectResult.errors,
    };
  }

  const { data: rows, error } = await admin
    .from('tenant_customer_portal_domains')
    .select('tenant_id, hostname, status, verification_token')
    .eq('status', 'pending');

  if (error) {
    throw new Error(error.message);
  }

  let activated = 0;
  let stillPending = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows ?? []) {
    const outcome = await syncCustomerPortalDomainVerification(admin, row.tenant_id);
    switch (outcome.status) {
      case 'activated':
        activated += 1;
        break;
      case 'pending':
      case 'already_active':
        stillPending += 1;
        break;
      case 'skipped':
      case 'missing':
        skipped += 1;
        break;
      case 'error':
        errors += 1;
        console.error('[customerPortalDomainCron]', outcome.hostname, outcome.message);
        break;
    }
  }

  const authRedirectResult = await processPendingSupabaseAuthRedirects(admin);

  return {
    scanned: rows?.length ?? 0,
    activated,
    stillPending,
    skipped,
    errors,
    vercelConfigured,
    authRedirectsScanned: authRedirectResult.scanned,
    authRedirectsRegistered: authRedirectResult.registered,
    authRedirectErrors: authRedirectResult.errors,
  };
}

export function customerPortalDomainSyncUserMessage(
  outcome: CustomerPortalDomainSyncOutcome,
): CustomerPortalDomainActionMessages {
  switch (outcome.status) {
    case 'missing':
      return { error: 'Save a custom domain before verifying DNS.' };
    case 'already_active':
      return { success: `${outcome.hostname} is already active.` };
    case 'activated':
      return {
        success: `${outcome.hostname} is verified and live. Customer invites will use https://${outcome.hostname}.`,
      };
    case 'pending':
      return {
        error: outcome.hint
          ? `DNS not verified yet. ${outcome.hint} Wait a few minutes for propagation, then try again (we also re-check automatically every few minutes).`
          : 'DNS not verified yet. Confirm the records below are published, wait for propagation, then try again (we also re-check automatically every few minutes).',
      };
    case 'skipped':
      return { error: outcome.reason };
    case 'error':
      return { error: outcome.message };
  }
}

export interface CustomerPortalDomainActionMessages {
  error?: string;
  success?: string;
}
