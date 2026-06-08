import { unstable_cache } from 'next/cache';
import { countPendingCustomerQuotes } from '@/lib/customer/customerQuoteList';
import { loadTenantUsageUtilizationAlert } from '@/lib/billing/loadTenantUsageUtilization';
import {
  loadOwnerOnboardingNavContext,
  type OwnerOnboardingNavContext,
} from '@/lib/tenant/loadOwnerOnboardingNavContext';
import { countSupportThreadsAwaitingReply } from '@/lib/tenant/openSupportThreadCount';
import { countPendingRescheduleRequests } from '@/lib/tenant/pendingRescheduleRequestCount';
import type { TenantRole } from '@/lib/auth/types';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import {
  customerIdsCacheKey,
  customerQuoteBadgeTag,
  tenantNavBadgesTag,
  tenantOnboardingTag,
  tenantUsageTag,
} from '@/lib/portal/cacheTags';

export async function getCachedOpenSupportThreadCount(tenantId: string): Promise<number> {
  return unstable_cache(
    async () => {
      const supabase = createTenantPortalDbClient();
      return countSupportThreadsAwaitingReply(supabase, tenantId);
    },
    ['tenant-open-support-threads', tenantId],
    { tags: [tenantNavBadgesTag(tenantId)], revalidate: 60 },
  )();
}

export async function getCachedPendingRescheduleCount(tenantId: string): Promise<number> {
  return unstable_cache(
    async () => {
      const supabase = createTenantPortalDbClient();
      return countPendingRescheduleRequests(supabase, tenantId);
    },
    ['tenant-pending-reschedule', tenantId],
    { tags: [tenantNavBadgesTag(tenantId)], revalidate: 60 },
  )();
}

export async function getCachedTenantUsageUtilizationAlert(tenantId: string) {
  return unstable_cache(
    async () => {
      const admin = createAdminClient();
      return loadTenantUsageUtilizationAlert(admin, tenantId);
    },
    ['tenant-usage-alert', tenantId],
    { tags: [tenantUsageTag(tenantId)], revalidate: 120 },
  )();
}

export async function getCachedOwnerOnboardingNavContext(params: {
  tenantId: string;
  tenantSlug: string;
  role: TenantRole;
  connectStatus: string | null | undefined;
}): Promise<OwnerOnboardingNavContext> {
  const { tenantId, tenantSlug, role, connectStatus } = params;
  return unstable_cache(
    async () => {
      const supabase = createTenantPortalDbClient();
      const admin = createAdminClient();
      return loadOwnerOnboardingNavContext({
        db: supabase,
        admin,
        tenantId,
        tenantSlug,
        role,
        connectStatus,
      });
    },
    ['tenant-onboarding-nav', tenantId, role, connectStatus ?? 'none'],
    { tags: [tenantOnboardingTag(tenantId)], revalidate: 60 },
  )();
}

export async function getCachedPendingCustomerQuoteCount(customerIds: string[]): Promise<number> {
  const key = customerIdsCacheKey(customerIds);
  if (!key) return 0;

  return unstable_cache(
    async () => {
      const admin = createAdminClient();
      return countPendingCustomerQuotes(admin, customerIds);
    },
    ['customer-pending-quote-count', key],
    {
      tags: customerIds.map((id) => customerQuoteBadgeTag(id)),
      revalidate: 60,
    },
  )();
}
