import Link from 'next/link';
import { CheckCircle2, Circle } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getPortalContext } from '@/lib/portal';
import { MONTH_END_CLOSE_STEPS } from '@/lib/reports/monthEndCloseSteps';
import { findReportDatePreset, reportPresetHref } from '@/lib/reports/reportDatePresets';
import styles from '../reports.module.scss';

export const dynamic = 'force-dynamic';

function stepHref(step: (typeof MONTH_END_CLOSE_STEPS)[number]): string {
  if (step.kind === 'report' && step.reportSlug) {
    const preset = findReportDatePreset('last-month');
    if (preset) {
      return reportPresetHref(step.reportSlug, preset);
    }
  }
  return step.href;
}

export default async function TenantMonthEndClosePage() {
  const { tenantSlug } = await getPortalContext();
  await requireTenantPortalAccess(tenantSlug, '/reports/close');

  const lastMonthPreset = findReportDatePreset('last-month');
  const lastQuarterPreset = findReportDatePreset('last-quarter');

  return (
    <>
      <PageHeader
        title="Month-end close"
        backHref="/reports"
        backLabel="Reports"
        titleHint="Work through collections, audits, and bank matching before exporting financial reports."
      />

      <Stack gap={6}>
        <Card
          title="Suggested date range"
          description="Most close reports use the prior calendar month. Use these presets when you open each report."
        >
          <div className={styles.presetRow}>
            {lastMonthPreset ? (
              <span className={styles.muted}>
                Last month: {lastMonthPreset.from} → {lastMonthPreset.to}
              </span>
            ) : null}
            {lastQuarterPreset ? (
              <span className={styles.muted}>
                Last quarter: {lastQuarterPreset.from} → {lastQuarterPreset.to}
              </span>
            ) : null}
          </div>
          <p className={styles.hint}>
            Individual reports also offer <strong>Last month</strong> and <strong>Last quarter</strong>{' '}
            presets on their date toolbar. Export CSV/PDF from each report when your review is complete.
          </p>
        </Card>

        <Card title="Close checklist" description="Follow in order — each step opens the right workspace area.">
          <ol className={styles.closeChecklist}>
            {MONTH_END_CLOSE_STEPS.map((step, index) => (
              <li key={step.id} className={styles.closeChecklistItem}>
                <span className={styles.closeChecklistIcon} aria-hidden>
                  <Circle size={18} />
                </span>
                <div className={styles.closeChecklistCopy}>
                  <span className={styles.closeChecklistStep}>
                    Step {index + 1}
                  </span>
                  <Link href={stepHref(step)} className={styles.closeChecklistTitle}>
                    {step.title}
                  </Link>
                  <p className={styles.closeChecklistDetail}>{step.detail}</p>
                </div>
                <CheckCircle2 size={18} className={styles.closeChecklistDoneHint} aria-hidden />
              </li>
            ))}
          </ol>
        </Card>
      </Stack>
    </>
  );
}
