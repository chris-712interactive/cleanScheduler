import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { isResendApiConfigured } from '@/lib/email/resend';
import {
  assertTenantFeatureEnabled,
  featureGateErrorMessage,
} from '@/lib/billing/tenantFeatureGate';
import {
  ensureCustomerPortalInvite,
  type CustomerPortalInviteResult,
} from '@/lib/tenant/customerPortalInvite';
import type { CustomerImportInviteSummary } from '@/lib/tenant/customerImport/types';

type Admin = SupabaseClient<Database>;

const INVITE_CONCURRENCY = 5;

export function tallyPortalInviteResult(
  summary: CustomerImportInviteSummary,
  result: CustomerPortalInviteResult,
): void {
  if (result.ok && result.alreadyLinked) {
    summary.alreadyLinked += 1;
    return;
  }
  if (result.ok && result.emailed) {
    summary.emailed += 1;
    return;
  }
  if (!result.ok && result.error.toLowerCase().includes('email address')) {
    summary.skippedNoEmail += 1;
    return;
  }
  summary.failed += 1;
  summary.error = result.ok ? summary.error : result.error;
}

async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      await worker(items[index]!);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
}

/** Email portal invites for customers created by this import. Existing customers are left alone. */
export async function sendPortalInvitesForImportedCustomers(input: {
  admin: Admin;
  tenantId: string;
  customerIds: string[];
  invitedByUserId?: string | null;
}): Promise<CustomerImportInviteSummary> {
  const summary: CustomerImportInviteSummary = {
    emailed: 0,
    skippedNoEmail: 0,
    alreadyLinked: 0,
    failed: 0,
  };

  if (input.customerIds.length === 0) return summary;

  try {
    await assertTenantFeatureEnabled(input.admin, input.tenantId, 'customerPortal');
  } catch (error) {
    const message = featureGateErrorMessage(error);
    return {
      ...summary,
      failed: input.customerIds.length,
      error: message ?? 'Portal invites are not available on this plan.',
    };
  }

  if (!isResendApiConfigured()) {
    return {
      ...summary,
      failed: input.customerIds.length,
      error: 'Email is not configured, so portal invites were not sent.',
    };
  }

  await mapWithConcurrency(input.customerIds, INVITE_CONCURRENCY, async (customerId) => {
    try {
      const result = await ensureCustomerPortalInvite({
        admin: input.admin,
        tenantId: input.tenantId,
        customerId,
        invitedByUserId: input.invitedByUserId,
        sendEmail: true,
      });
      tallyPortalInviteResult(summary, result);
    } catch (error) {
      summary.failed += 1;
      summary.error = error instanceof Error ? error.message : 'Portal invite failed.';
    }
  });

  return summary;
}
