import Link from 'next/link';
import { Wallet, Receipt, FileSpreadsheet } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { DashboardStatCard } from '@/app/tenant/DashboardStatCard';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { resolveTenantPlanTier } from '@/lib/billing/entitlements';
import {
  isReportEnabled,
  reportsBySection,
} from '@/lib/reports/reportCatalog';
import { getReportsHubMetrics } from '@/lib/reports/hubMetrics';
import styles from './reports.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantReportsHubPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/reports');

  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const supabase = createTenantPortalDbClient();
  const metrics = await getReportsHubMetrics(supabase, membership.tenantId);

  const sections = reportsBySection();

  return (
    <>
      <PageHeader
        title="Reports"
        titleHint="Financial close, operations, and payroll exports for your cleaning business."
      />

      <div className={styles.statGrid}>
        <DashboardStatCard
          icon={<Wallet size={20} />}
          label="Outstanding AR"
          value={metrics.outstandingTotal}
          badge={metrics.outstandingBadge}
          badgeTone="warn"
          actionLabel="View aging"
          actionHref="/reports/outstanding-balances"
        />
        <DashboardStatCard
          icon={<Receipt size={20} />}
          label="Collected (7d)"
          value={metrics.collected7d}
          badge="Net payments"
          badgeTone="brand"
          actionLabel="Collections"
          actionHref="/reports/collections-summary"
        />
        <DashboardStatCard
          icon={<FileSpreadsheet size={20} />}
          label="Open checks"
          value={metrics.openChecks}
          badge="Last 7 days"
          badgeTone="muted"
          actionLabel="Field checks"
          actionHref="/reports/field-check-tracking"
        />
      </div>

      {sections.map(({ section, label, items }) => (
        <section key={section} className={styles.sectionBlock} aria-labelledby={`reports-${section}`}>
          <h2 id={`reports-${section}`} className={styles.sectionHeading}>
            {label}
          </h2>
          <nav className={styles.hubGrid} aria-label={label}>
            {items.map((entry) => {
              const enabled = isReportEnabled(tier, entry.slug);
              const Icon = entry.icon;
              return (
                <Link
                  key={entry.slug}
                  href={`/reports/${entry.slug}`}
                  className={styles.hubCard}
                  data-locked={enabled ? undefined : true}
                >
                  <span className={styles.hubCardIcon} aria-hidden>
                    <Icon size={22} strokeWidth={2} />
                  </span>
                  <span className={styles.hubCardCopy}>
                    <span className={styles.hubCardTitle}>{entry.title}</span>
                    <span className={styles.hubCardDescription}>{entry.description}</span>
                    {!enabled ? (
                      <span className={styles.lockBadge}>
                        {entry.minimumTierLabel ?? 'Pro'} — upgrade to unlock
                      </span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </nav>
        </section>
      ))}

      {sections.every((s) => s.items.length === 0) ? (
        <EmptyState title="No reports" description="Report catalog is empty." />
      ) : null}
    </>
  );
}
