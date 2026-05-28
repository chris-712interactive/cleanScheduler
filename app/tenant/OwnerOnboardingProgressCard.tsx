'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import type { OwnerOnboardingChecklist } from '@/lib/tenant/ownerOnboardingChecklist';
import {
  dismissOwnerChecklistAction,
  snoozeOwnerChecklistAction,
} from '@/app/tenant/ownerOnboardingActions';
import checklistStyles from './ownerOnboardingChecklist.module.scss';
import styles from './dashboard.module.scss';

export function OwnerOnboardingProgressCard({
  tenantSlug,
  checklist,
}: {
  tenantSlug: string;
  checklist: OwnerOnboardingChecklist;
}) {
  const progressPct = Math.round((checklist.completedCount / checklist.totalRequired) * 100);

  return (
    <Card title="Setup progress" titleHint="Required steps for quotes, schedule, and billing.">
      <div className={styles.progressBlock}>
        <div
          className={styles.progressBarTrack}
          role="progressbar"
          aria-valuenow={checklist.completedCount}
          aria-valuemin={0}
          aria-valuemax={checklist.totalRequired}
          aria-label={`${checklist.completedCount} of ${checklist.totalRequired} required steps complete`}
        >
          <div className={styles.progressBarFill} style={{ width: `${progressPct}%` }} />
        </div>
        <p className={styles.progressLabel}>
          <strong>
            {checklist.completedCount} of {checklist.totalRequired}
          </strong>{' '}
          required steps complete
        </p>
        {checklist.incompleteRequiredCount > 0 ? (
          <p className={styles.progressRemaining}>{checklist.incompleteRequiredCount} remaining</p>
        ) : null}
        <Link href="/getting-started" className={styles.progressLink}>
          See all steps →
        </Link>
      </div>

      <div className={`${checklistStyles.cardActions} ${styles.progressActions}`}>
        <form action={snoozeOwnerChecklistAction}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <button type="submit" className={checklistStyles.secondaryAction}>
            Snooze 7 days
          </button>
        </form>
        <form action={dismissOwnerChecklistAction}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <button type="submit" className={checklistStyles.secondaryAction}>
            Dismiss for now
          </button>
        </form>
      </div>
    </Card>
  );
}
