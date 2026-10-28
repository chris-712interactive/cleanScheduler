import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill, type StatusTone } from '@/components/ui/StatusPill';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { isFeatureEnabled, resolveTenantEntitlementPlan } from '@/lib/billing/entitlements';
import { getPortalContext } from '@/lib/portal';
import { createAdminClient } from '@/lib/supabase/server';
import {
  hasPermission,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';
import styles from './hiring.module.scss';

export const dynamic = 'force-dynamic';

const OPENING_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  open: 'Live',
  closed: 'Closed',
};

function openingTone(status: string): StatusTone {
  if (status === 'open') return 'success';
  if (status === 'draft') return 'warning';
  return 'neutral';
}

export default async function HiringPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/hiring');
  const admin = createAdminClient();
  const plan = await resolveTenantEntitlementPlan(admin, membership.tenantId);
  const enabled = isFeatureEnabled(plan, 'hiringDesk');

  if (!enabled) {
    return (
      <>
        <PageHeader
          title="Hiring"
          description="Screen applicants and hold interview times for people who will actually show up."
        />
        <FeatureUpgradePanel
          title="Hiring is on Business and Pro"
          description="Publish tomorrow’s interview slots, screen on pay and schedule, and turn a show-up into a team invite. Starter and the free trial do not include it."
        />
      </>
    );
  }

  const permissions = await resolveMembershipPermissions(admin, membership);
  const allowed =
    hasPermission(permissions, 'hiring.view') ||
    membership.role === 'owner' ||
    membership.role === 'admin';
  if (!allowed) {
    return (
      <PageHeader
        title="Hiring"
        description="You do not have access to hiring for this workspace."
      />
    );
  }

  const { data: openings } = await admin
    .from('tenant_hiring_openings')
    .select('id, title, status, kind, area_text')
    .eq('tenant_id', membership.tenantId)
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader
        title="Hiring"
        titleHint="Publish interview times before you share a link. People who pass the questions get the earliest open time by email and have to tap to keep it. This company is the employer."
        actions={
          <Button as={Link} href="/hiring/new">
            New opening
          </Button>
        }
      />
      {(openings ?? []).length === 0 ? (
        <EmptyState
          title="No openings yet"
          description="Create a role, publish a couple of times for tomorrow, then copy the link into the job post you already use."
        />
      ) : (
        <ul className={styles.openingGrid}>
          {(openings ?? []).map((opening) => (
            <li key={opening.id}>
              <Link href={`/hiring/${opening.id}`} className={styles.openingCard}>
                <span className={styles.openingTop}>
                  <strong>{opening.title}</strong>
                  <StatusPill tone={openingTone(opening.status)}>
                    {OPENING_STATUS_LABEL[opening.status] ?? opening.status}
                  </StatusPill>
                </span>
                <p className={styles.muted}>
                  {opening.kind === 'office' ? 'Office' : 'Field'}
                  {opening.area_text ? ` · ${opening.area_text}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
