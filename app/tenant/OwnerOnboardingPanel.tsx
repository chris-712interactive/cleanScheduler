'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import type { OwnerOnboardingChecklist } from '@/lib/tenant/ownerOnboardingChecklist';
import styles from './ownerOnboardingPanel.module.scss';

export function OwnerOnboardingPanel({
  tenantId,
  checklist,
}: {
  tenantId: string;
  checklist: OwnerOnboardingChecklist;
}) {
  const storageKey = `owner-onboarding-dismissed:${tenantId}`;
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [storageKey]);

  if (checklist.allRequiredComplete || dismissed) {
    return null;
  }

  return (
    <Card
      title="Getting started"
      titleHint={`${checklist.completedCount} of ${checklist.totalRequired} required steps complete`}
      description="Finish these basics so quotes, scheduling, and billing flow smoothly."
    >
      <ol className={styles.list}>
        {checklist.steps.map((step) => (
          <li
            key={step.id}
            className={styles.item}
            data-complete={step.complete || undefined}
            data-optional={step.optional || undefined}
          >
            <span className={styles.marker} aria-hidden>
              {step.complete ? '✓' : '○'}
            </span>
            <div className={styles.copy}>
              <Link href={step.href} className={styles.title}>
                {step.title}
                {step.optional ? <span className={styles.optional}>Optional</span> : null}
              </Link>
              <p className={styles.detail}>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => {
          try {
            window.localStorage.setItem(storageKey, '1');
          } catch {
            // ignore
          }
          setDismissed(true);
        }}
      >
        Dismiss for now
      </button>
    </Card>
  );
}
