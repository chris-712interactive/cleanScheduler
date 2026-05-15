import { StatusPill } from '@/components/ui/StatusPill';
import { VISIT_STATUS_LABEL, VISIT_STATUS_TONE, type VisitStatus } from '@/lib/schedule/visitStatus';
import styles from './schedule.module.scss';

export function VisitStatusPill({
  status,
  className,
}: {
  status: VisitStatus;
  className?: string;
}) {
  return (
    <StatusPill
      tone={VISIT_STATUS_TONE[status]}
      className={[styles.visitStatusPill, className].filter(Boolean).join(' ')}
    >
      {VISIT_STATUS_LABEL[status]}
    </StatusPill>
  );
}
