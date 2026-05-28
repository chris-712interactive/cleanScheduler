import type { SupabaseClient } from '@supabase/supabase-js';
import { countActiveAutomationWorkflows } from '@/lib/billing/automationWorkflows';
import { countSmsSegmentsUsedThisMonth } from '@/lib/billing/smsCredits';
import { countTeamSeatUsage } from '@/lib/billing/teamSeats';
import { countMarketingSendsThisMonth } from '@/lib/campaigns/campaignLimits';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

function snapshotDateUtc(): string {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

export async function rollupTenantUsageSnapshot(
  admin: Admin,
  tenantId: string,
  snapshotDate = snapshotDateUtc(),
): Promise<void> {
  const [seatUsage, customerCount, smsSegments, emailSends, automationRules] = await Promise.all([
    countTeamSeatUsage(admin, tenantId, { includePendingInvites: true }),
    admin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .then(({ count, error }) => {
        if (error) throw new Error(error.message);
        return count ?? 0;
      }),
    countSmsSegmentsUsedThisMonth(admin, tenantId),
    countMarketingSendsThisMonth(admin, tenantId),
    countActiveAutomationWorkflows(admin, tenantId),
  ]);

  const activeUserCount = seatUsage.officeUsed + seatUsage.fieldUsed;

  const row: Database['public']['Tables']['tenant_usage_snapshots']['Insert'] = {
    tenant_id: tenantId,
    snapshot_date: snapshotDate,
    active_user_count: activeUserCount,
    active_customer_count: customerCount,
    sms_segments_used: smsSegments,
    email_sends: emailSends,
  };

  const { error } = await admin.from('tenant_usage_snapshots').upsert(row, {
    onConflict: 'tenant_id,snapshot_date',
  });

  if (error) {
    throw new Error(error.message);
  }

  void automationRules;
}

export async function rollupAllTenantUsageSnapshots(
  admin: Admin,
): Promise<{ tenantCount: number; snapshotDate: string }> {
  const snapshotDate = snapshotDateUtc();
  const { data: tenants, error } = await admin.from('tenants').select('id').eq('is_active', true);

  if (error) {
    throw new Error(error.message);
  }

  for (const tenant of tenants ?? []) {
    await rollupTenantUsageSnapshot(admin, tenant.id, snapshotDate);
  }

  return { tenantCount: tenants?.length ?? 0, snapshotDate };
}
