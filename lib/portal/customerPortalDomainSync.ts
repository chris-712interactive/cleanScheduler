import type { SupabaseClient } from '@supabase/supabase-js';
import {
  assertWhiteLabelCustomerPortalAllowed,
  whiteLabelPortalGateErrorMessage,
} from '@/lib/billing/whiteLabelPortalGate';
import { verifyCustomerPortalDomainTxt } from '@/lib/portal/customerPortalDnsVerify';
import { customerPortalVerificationRecordName } from '@/lib/portal/customerPortalHostname';
import {
  ensureVercelProjectDomainTarget,
  getVercelDomainDnsConfig,
  getVercelProjectDomain,
  isVercelDomainAutomationConfigured,
  isVercelDomainFullyVerified,
  vercelDomainErrorMessage,
  verifyVercelProjectDomain,
} from '@/lib/portal/vercelProjectDomains';
import {
  cleanupCustomerPortalDomainResources,
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
  return `Add a ${hint.type} record for ${hint.domain} with the value shown below.`;
}

function routingHintMessage(
  hostname: string,
  config: { recommendedCname: string | null; recommendedARecords: string[] },
): string {
  if (config.recommendedCname) {
    return `Add a CNAME record so ${hostname} points to ${config.recommendedCname}.`;
  }
  if (config.recommendedARecords.length > 0) {
    return `Add an A record for ${hostname} pointing to ${config.recommendedARecords.join(' or ')}.`;
  }
  return 'Add the DNS records shown on this page.';
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
      reason:
        whiteLabelPortalGateErrorMessage(error) ?? 'Workspace not eligible for white-label portal.',
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

  if (!isVercelDomainFullyVerified(vercelDomain)) {
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

  let dnsConfig;
  try {
    dnsConfig = await getVercelDomainDnsConfig(hostname);
  } catch (error) {
    const message =
      vercelDomainErrorMessage(error) ?? 'Could not load DNS routing requirements from Vercel.';
    return { status: 'error', hostname, message };
  }

  if (dnsConfig.misconfigured) {
    await admin
      .from('tenant_customer_portal_domains')
      .update({
        vercel_verification: vercelDomain.verification as unknown as Json,
        vercel_last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    return {
      status: 'pending',
      hostname,
      hint: routingHintMessage(hostname, dnsConfig),
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
      return { error: 'Enter your portal address before checking the connection.' };
    case 'already_active':
      return { success: `${outcome.hostname} is already connected.` };
    case 'activated':
      return {
        success: `${outcome.hostname} is connected. Customer invite links will use https://${outcome.hostname}.`,
      };
    case 'pending':
      return {
        error: outcome.hint
          ? `Not connected yet. ${outcome.hint} DNS changes can take a few minutes — try again shortly.`
          : 'Not connected yet. Make sure the records below are saved at your domain provider, wait a few minutes, then try again.',
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

type CustomerPortalDomainRow = {
  hostname: string;
  status: string;
  verification_token: string | null;
  verified_at: string | null;
  vercel_verification: Json | null;
  vercel_last_error: string | null;
  auth_redirect_last_error: string | null;
};

/** Refresh Vercel DNS state and fix domains that were marked active before DNS was configured. */
export async function reconcileCustomerPortalDomainWithVercel(
  admin: SupabaseClient<Database>,
  tenantId: string,
): Promise<CustomerPortalDomainRow | null> {
  if (!isVercelDomainAutomationConfigured()) {
    return null;
  }

  const { data: row, error: rowErr } = await admin
    .from('tenant_customer_portal_domains')
    .select(
      'hostname, status, verification_token, verified_at, vercel_verification, vercel_last_error, auth_redirect_last_error',
    )
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (rowErr || !row?.hostname) {
    return null;
  }

  try {
    await ensureVercelProjectDomainTarget(row.hostname);
  } catch (error) {
    console.error('[customerPortalDomain] Vercel domain target update failed:', error);
  }

  let vercelDomain;
  try {
    vercelDomain = await getVercelProjectDomain(row.hostname);
  } catch (error) {
    const message =
      vercelDomainErrorMessage(error) ?? 'Could not load DNS instructions from Vercel.';
    if (row.vercel_last_error === message) {
      return row;
    }

    await admin
      .from('tenant_customer_portal_domains')
      .update({
        vercel_last_error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    return { ...row, vercel_last_error: message };
  }

  let dnsConfig;
  try {
    dnsConfig = await getVercelDomainDnsConfig(row.hostname);
  } catch (error) {
    console.error('[customerPortalDomain] Vercel DNS config load failed:', error);
    dnsConfig = null;
  }

  const fullyVerified = isVercelDomainFullyVerified(vercelDomain);
  const routingReady = dnsConfig ? !dnsConfig.misconfigured : fullyVerified;
  const now = new Date().toISOString();
  const updatePayload: {
    vercel_verification: Json;
    vercel_last_error: null;
    updated_at: string;
    status?: string;
    verified_at?: string | null;
  } = {
    vercel_verification: vercelDomain.verification as unknown as Json,
    vercel_last_error: null,
    updated_at: now,
  };

  if (row.status === 'active' && (!fullyVerified || !routingReady)) {
    await cleanupCustomerPortalDomainResources(row.hostname);
    updatePayload.status = 'pending';
    updatePayload.verified_at = null;
  }

  await admin
    .from('tenant_customer_portal_domains')
    .update(updatePayload)
    .eq('tenant_id', tenantId);

  return {
    ...row,
    status: updatePayload.status ?? row.status,
    verified_at: updatePayload.verified_at === null ? null : row.verified_at,
    vercel_verification: updatePayload.vercel_verification,
    vercel_last_error: null,
  };
}
