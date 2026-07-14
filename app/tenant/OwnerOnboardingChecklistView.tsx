'use client';

import Link from 'next/link';
import { Check, Circle, Minus } from 'lucide-react';
import type { OwnerOnboardingChecklist } from '@/lib/tenant/ownerOnboardingChecklist';
import {
  dismissOwnerChecklistAction,
  reopenOwnerChecklistAction,
  skipOptionalChecklistStepAction,
  snoozeOwnerChecklistAction,
} from '@/app/tenant/ownerOnboardingActions';
import styles from './ownerOnboardingChecklist.module.scss';

function StepMarker({ complete, locked }: { complete: boolean; locked: boolean }) {
  if (complete) return <Check size={16} strokeWidth={2.25} aria-hidden />;
  if (locked) return <Minus size={16} strokeWidth={2.25} aria-hidden />;
  return <Circle size={16} strokeWidth={2.25} aria-hidden />;
}

export function OwnerOnboardingChecklistView({
  tenantSlug,
  checklist,
  variant = 'card',
}: {
  tenantSlug: string;
  checklist: OwnerOnboardingChecklist;
  variant?: 'card' | 'page';
}) {
  const { uiState, snoozedUntil } = checklist;

  return (
    <div className={styles.root} data-variant={variant}>
      {variant === 'page' && uiState === 'dismissed' ? (
        <p className={styles.notice} role="status">
          You dismissed this checklist from the dashboard. It stays here until you finish the
          required steps.
        </p>
      ) : null}

      {variant === 'page' && uiState === 'snoozed' && snoozedUntil ? (
        <p className={styles.notice} role="status">
          Snoozed on the dashboard until{' '}
          {new Date(snoozedUntil).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
          .
        </p>
      ) : null}

      <ol className={styles.list}>
        {checklist.steps.map((step) => (
          <li
            key={step.id}
            className={styles.item}
            data-complete={step.complete || undefined}
            data-optional={step.optional || undefined}
            data-locked={step.locked || undefined}
          >
            <span className={styles.marker} aria-hidden>
              <StepMarker complete={step.complete} locked={Boolean(step.locked)} />
            </span>
            <div className={styles.copy}>
              {step.locked ? (
                <span className={styles.titleLocked}>{step.title}</span>
              ) : (
                <Link href={step.href} className={styles.title}>
                  {step.title}
                  {step.optional ? <span className={styles.optional}>Optional</span> : null}
                  {step.skipped ? <span className={styles.skipped}>Skipped</span> : null}
                </Link>
              )}
              {!step.locked && step.optional && !step.complete ? (
                <form action={skipOptionalChecklistStepAction} className={styles.skipForm}>
                  <input type="hidden" name="tenant_slug" value={tenantSlug} />
                  <input type="hidden" name="step_id" value={step.id} />
                  <button type="submit" className={styles.skipButton}>
                    Skip for now
                  </button>
                </form>
              ) : null}
              <p className={styles.detail}>
                {step.detail}
                {step.locked && step.lockedReason ? (
                  <>
                    {' '}
                    <Link href={step.href} className={styles.inlineLink}>
                      {step.lockedReason}
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {variant === 'card' ? (
        <div className={styles.cardActions}>
          <form action={snoozeOwnerChecklistAction}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <button type="submit" className={styles.secondaryAction}>
              Snooze 7 days
            </button>
          </form>
          <form action={dismissOwnerChecklistAction}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <button type="submit" className={styles.secondaryAction}>
              Dismiss for now
            </button>
          </form>
          <Link href="/getting-started" className={styles.fullLink}>
            View full checklist
          </Link>
        </div>
      ) : (
        <div className={styles.pageActions}>
          {uiState === 'dismissed' || uiState === 'snoozed' ? (
            <form action={reopenOwnerChecklistAction}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <button type="submit" className={styles.primaryAction}>
                Show on dashboard again
              </button>
            </form>
          ) : (
            <>
              <form action={snoozeOwnerChecklistAction}>
                <input type="hidden" name="tenant_slug" value={tenantSlug} />
                <button type="submit" className={styles.secondaryAction}>
                  Snooze dashboard card 7 days
                </button>
              </form>
              <form action={dismissOwnerChecklistAction}>
                <input type="hidden" name="tenant_slug" value={tenantSlug} />
                <button type="submit" className={styles.secondaryAction}>
                  Dismiss dashboard card
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
