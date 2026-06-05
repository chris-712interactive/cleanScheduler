import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { ConsultationStatus } from '@/lib/tenant/customerConsultation';
import { buildScheduleConsultationPath } from '@/lib/tenant/customerConsultation';
import { formatVisitWhenRange } from '@/lib/datetime/formatInTimeZone';
import styles from './customers.module.scss';

export function CustomerConsultationBanner({
  status,
  customerId,
  primaryPropertyId,
  tenantTimezone,
  nextConsultation,
}: {
  status: ConsultationStatus;
  customerId: string;
  primaryPropertyId: string | null;
  tenantTimezone: string;
  nextConsultation: { id: string; startsAt: string; endsAt: string } | null;
}) {
  if (status === 'not_required' || status === 'completed') return null;

  const scheduleHref = buildScheduleConsultationPath(customerId, primaryPropertyId);

  if (status === 'needs_scheduling') {
    return (
      <div className={styles.consultationBanner} role="status">
        <div className={styles.consultationBannerCopy}>
          <strong>Consultation required</strong>
          <p>Schedule a consultation and mark it complete before sending this customer a quote.</p>
        </div>
        <Button as={Link} href={scheduleHref} variant="primary">
          Schedule consultation
        </Button>
      </div>
    );
  }

  const whenLabel = nextConsultation
    ? formatVisitWhenRange(nextConsultation.startsAt, nextConsultation.endsAt, tenantTimezone)
    : 'Scheduled';

  return (
    <div className={styles.consultationBanner} role="status">
      <div className={styles.consultationBannerCopy}>
        <strong>Consultation scheduled</strong>
        <p>{whenLabel}. Mark the consultation complete on the visit before sending a quote.</p>
      </div>
      {nextConsultation ? (
        <Button as={Link} href={`/schedule/${nextConsultation.id}`} variant="secondary">
          Open consultation
        </Button>
      ) : (
        <Button as={Link} href={scheduleHref} variant="secondary">
          Schedule consultation
        </Button>
      )}
    </div>
  );
}
