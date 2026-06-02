'use client';

import { useActionState } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { retryQuoteAutoSchedule, type RetryAutoScheduleState } from './actions';
import styles from './quotes.module.scss';

const initial: RetryAutoScheduleState = {};

export function QuoteAutoScheduleBanner({
  tenantSlug,
  quoteId,
  flaggedLineCount,
  expectedVisitCount,
}: {
  tenantSlug: string;
  quoteId: string;
  flaggedLineCount: number;
  expectedVisitCount: number;
}) {
  const [state, formAction, pending] = useActionState(retryQuoteAutoSchedule, initial);

  if (state.success && state.createdCount && state.createdCount > 0) {
    return (
      <p className={styles.autoScheduleBannerSuccess} role="status">
        Created {state.createdCount} scheduled visit{state.createdCount === 1 ? '' : 's'} from this
        quote. Refresh the schedule to see them.
      </p>
    );
  }

  if (state.success && state.createdCount === 0) {
    return null;
  }

  return (
    <div className={styles.autoScheduleBanner} role="status">
      <CalendarClock size={20} aria-hidden className={styles.autoScheduleBannerIcon} />
      <div className={styles.autoScheduleBannerBody}>
        <p className={styles.autoScheduleBannerTitle}>
          Auto-schedule did not create visits ({flaggedLineCount} flagged line
          {flaggedLineCount === 1 ? '' : 's'}, {expectedVisitCount} expected visit
          {expectedVisitCount === 1 ? '' : 's'})
        </p>
        <p className={styles.autoScheduleBannerHint}>
          {state.error ??
            'This can happen if database migrations are pending or visit creation failed. You can retry or schedule manually.'}
        </p>
        <form action={formAction} className={styles.autoScheduleBannerActions}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="quote_id" value={quoteId} />
          <Button type="submit" variant="secondary" size="sm" disabled={pending}>
            {pending ? 'Creating visits…' : 'Retry auto-schedule'}
          </Button>
        </form>
      </div>
    </div>
  );
}
