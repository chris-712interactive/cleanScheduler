'use client';

import { PartyPopper } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { acknowledgeChecklistCompletionAction } from '@/app/tenant/ownerOnboardingActions';
import styles from './ownerOnboardingCompletionCelebration.module.scss';

export function OwnerOnboardingCompletionCelebration({ tenantSlug }: { tenantSlug: string }) {
  return (
    <Card
      title="You're set up!"
      titleHint="Required getting-started steps are complete."
      className={styles.card}
    >
      <div className={styles.content}>
        <span className={styles.iconWrap} aria-hidden>
          <PartyPopper size={28} strokeWidth={1.75} />
        </span>
        <p className={styles.lead}>
          Your workspace has quotes, customers, scheduling, and billing basics in place. Explore
          reports, campaigns, and advanced settings whenever you are ready.
        </p>
        <form action={acknowledgeChecklistCompletionAction}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <button type="submit" className={styles.button}>
            Got it
          </button>
        </form>
      </div>
    </Card>
  );
}
