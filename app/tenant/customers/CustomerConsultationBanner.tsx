import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import type { ConsultationStatus } from '@/lib/tenant/customerConsultation';
import { buildScheduleConsultationPath } from '@/lib/tenant/customerConsultation';
import type { PropertyConsultationPrompt } from '@/lib/tenant/propertyConsultationRequest';
import { formatVisitWhenRange } from '@/lib/datetime/formatInTimeZone';
import styles from './customers.module.scss';

export function CustomerConsultationBanner({
  status,
  customerId,
  primaryPropertyId,
  tenantTimezone,
  nextConsultation,
  returnTo,
}: {
  status: ConsultationStatus;
  customerId: string;
  primaryPropertyId: string | null;
  tenantTimezone: string;
  nextConsultation: { id: string; startsAt: string; endsAt: string } | null;
  /** After scheduling, send staff back here (e.g. quote detail). */
  returnTo?: string | null;
}) {
  if (status === 'not_required' || status === 'completed') return null;

  const scheduleHref = buildScheduleConsultationPath(customerId, primaryPropertyId, {
    returnTo,
  });

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

export function PropertyRequestBanner({
  customerId,
  requests,
}: {
  customerId: string;
  requests: Array<{
    propertyId: string;
    label: string;
    phase: PropertyConsultationPrompt['phase'];
    visitId: string | null;
  }>;
}) {
  const waiting = requests.filter((request) => request.phase === 'needs_scheduling');
  const booked = requests.filter((request) => request.phase === 'scheduled');
  if (waiting.length === 0 && booked.length === 0) return null;

  const firstWaiting = waiting[0];
  const firstBooked = booked.find((request) => request.visitId) ?? booked[0];
  const names = (waiting.length > 0 ? waiting : booked).map((request) => request.label).join(', ');

  return (
    <div className={styles.consultationBanner} role="status">
      <div className={styles.consultationBannerCopy}>
        <strong>
          {waiting.length > 0 ? 'New location needs a consultation' : 'Consultation scheduled'}
        </strong>
        <p>
          {waiting.length > 0
            ? `${names} ${waiting.length === 1 ? 'was' : 'were'} requested by this customer. Schedule a walkthrough before quoting that location.`
            : `A consultation is already booked for ${names}.`}
        </p>
      </div>
      {firstWaiting ? (
        <Button
          as={Link}
          href={buildScheduleConsultationPath(customerId, firstWaiting.propertyId)}
          variant="primary"
        >
          Schedule consultation
        </Button>
      ) : firstBooked?.visitId ? (
        <Button as={Link} href={`/schedule/${firstBooked.visitId}`} variant="secondary">
          Open consultation
        </Button>
      ) : null}
    </div>
  );
}
