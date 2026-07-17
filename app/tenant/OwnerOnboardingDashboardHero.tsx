import Link from 'next/link';
import { ArrowRight, Circle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  getNextIncompleteRequiredSteps,
  type OwnerOnboardingChecklist,
} from '@/lib/tenant/ownerOnboardingChecklist';
import styles from './dashboard.module.scss';

const STEP_ACTION_LABELS: Record<string, string> = {
  business: 'Complete profile',
  quote: 'Create quote',
  customer: 'Add customer',
  visit: 'Schedule visit',
  connect: 'Set up payments',
  invoice: 'Send invoice',
  team: 'Invite teammate',
};

function stepActionLabel(stepId: string, href: string): string {
  return STEP_ACTION_LABELS[stepId] ?? `Go to ${href.replace(/^\//, '')}`;
}

export function OwnerOnboardingDashboardHero({
  checklist,
}: {
  checklist: OwnerOnboardingChecklist;
}) {
  const nextSteps = getNextIncompleteRequiredSteps(checklist, 2);
  const primary = nextSteps[0];
  if (!primary) return null;

  const secondary = nextSteps[1];

  return (
    <Card
      title="Next up"
      titleHint="Work through these in order — quote, customer, then schedule."
      className={styles.nextStepCard}
    >
      <div className={styles.nextStepHero}>
        <div className={styles.nextStepPrimary}>
          <span className={styles.nextStepMarker} aria-hidden>
            <Circle size={18} strokeWidth={2.25} />
          </span>
          <div className={styles.nextStepCopy}>
            {primary.locked ? (
              <span className={styles.nextStepTitle}>{primary.title}</span>
            ) : (
              <Link href={primary.href} className={styles.nextStepTitle}>
                {primary.title}
              </Link>
            )}
            <p className={styles.nextStepDetail}>{primary.detail}</p>
            {!primary.locked ? (
              <Button
                as={Link}
                href={primary.href}
                iconRight={<ArrowRight size={16} />}
                className={styles.nextStepCta}
              >
                {stepActionLabel(primary.id, primary.href)}
              </Button>
            ) : null}
          </div>
        </div>

        {secondary ? (
          <div className={styles.nextStepSecondary}>
            <span className={styles.nextStepMarkerMuted} aria-hidden>
              <Circle size={16} strokeWidth={2} />
            </span>
            <div>
              <p className={styles.nextStepSecondaryLabel}>Then</p>
              {secondary.locked ? (
                <span className={styles.nextStepSecondaryTitle}>{secondary.title}</span>
              ) : (
                <Link href={secondary.href} className={styles.nextStepSecondaryTitle}>
                  {secondary.title}
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
