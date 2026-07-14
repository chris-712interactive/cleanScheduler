'use client';

import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { acknowledgeChecklistCompletionAction } from '@/app/tenant/ownerOnboardingActions';
import styles from './ownerOnboardingCompletionCelebration.module.scss';

export function OwnerOnboardingCompletionCelebration({ tenantSlug }: { tenantSlug: string }) {
  return (
    <Card
      title="Setup complete"
      titleHint="Required getting-started steps are finished."
      className={styles.card}
    >
      <div className={styles.content}>
        <span className={styles.iconWrap} aria-hidden>
          <CheckCircle2 size={28} strokeWidth={1.75} />
        </span>
        <p className={styles.lead}>
          Your workspace has quotes, customers, scheduling, and billing basics in place. Explore
          reports, campaigns, and advanced settings whenever you are ready.
        </p>
        <form action={acknowledgeChecklistCompletionAction}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <Button type="submit">Continue to dashboard</Button>
        </form>
      </div>
    </Card>
  );
}
