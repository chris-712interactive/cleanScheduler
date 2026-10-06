'use client';

import Link from 'next/link';
import { MapPin, Navigation, Phone } from 'lucide-react';
import { googleMapsDirectionsUrl } from '@/lib/geo/googleMapsDirectionsUrl';
import { formatVisitTimeRange } from './scheduleTimelineUtils';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import type { ScheduleVisitVM } from './TenantScheduleClient';
import styles from './schedule.module.scss';

function fieldStatusLabel(visit: ScheduleVisitVM): string {
  if (visit.status === 'completed') return 'Done';
  if (visit.status === 'cancelled') return 'Cancelled';
  if (visit.checkedInAt) return 'Checked in';
  return 'Scheduled';
}

function primaryAction(visit: ScheduleVisitVM): { href: string; label: string } | null {
  if (visit.status !== 'scheduled') {
    return { href: `/schedule/${visit.id}`, label: 'Open job' };
  }
  if (!visit.checkedInAt) {
    return { href: `/schedule/${visit.id}?action=checkin`, label: 'Check in' };
  }
  return { href: `/schedule/${visit.id}?action=complete`, label: 'Complete' };
}

export function FieldEmployeeDayJobs({
  visits,
  isLocalToday,
  tenantTimezone,
}: {
  visits: ScheduleVisitVM[];
  isLocalToday: boolean;
  tenantTimezone: string;
}) {
  if (visits.length === 0) {
    return (
      <div className={styles.fieldJobEmpty}>
        <p className={styles.fieldJobEmptyTitle}>
          {isLocalToday ? 'Nothing scheduled today' : 'No jobs on this day'}
        </p>
        <p className={styles.fieldJobEmptyHint}>
          Use the arrows to check another day. Assigned visits show up here.
        </p>
      </div>
    );
  }

  const nextUpId = isLocalToday
    ? (visits.find(
        (visit) =>
          visit.status === 'scheduled' &&
          !visit.checkedInAt &&
          new Date(visit.ends_at).getTime() >= Date.now(),
      )?.id ?? null)
    : null;

  return (
    <ul className={styles.fieldJobList}>
      {visits.map((visit) => {
        const serviceLabel = visit.quoteTitle?.trim() || visit.title?.trim() || 'Cleaning visit';
        const action = primaryAction(visit);
        const mapsQuery = visit.siteLine?.trim() ? googleMapsDirectionsUrl(visit.siteLine) : null;
        const phoneHref = visit.customerPhone
          ? `tel:${visit.customerPhone.replace(/[^\d+]/g, '')}`
          : null;
        const isNextUp = visit.id === nextUpId;
        const statusLabel = isNextUp ? 'Up next' : fieldStatusLabel(visit);

        return (
          <li key={visit.id} className={styles.fieldJobCardShell}>
            <article className={styles.fieldJobCard}>
              <div className={styles.fieldJobCardHeader}>
                <p className={styles.fieldJobCardTime}>
                  {formatVisitTimeRange(visit.starts_at, visit.ends_at, tenantTimezone)}
                </p>
                <span
                  className={styles.fieldJobStatusChip}
                  data-status={visit.status}
                  data-checked-in={visit.checkedInAt ? 'true' : 'false'}
                  data-next={isNextUp ? 'true' : 'false'}
                >
                  {statusLabel}
                </span>
              </div>

              <h3 className={styles.fieldJobCardCustomer}>{visit.customerName}</h3>
              <p className={styles.fieldJobCardService}>
                {serviceLabel}
                {visit.expectedAmountCents != null
                  ? ` · $${formatCentsAsDollars(visit.expectedAmountCents)}`
                  : ''}
              </p>

              {visit.siteLine || visit.communityName ? (
                <p className={styles.fieldJobAddress}>
                  <MapPin size={18} aria-hidden className={styles.fieldJobCardIcon} />
                  <span>
                    {visit.communityName ? (
                      <span className={styles.fieldJobCommunity}>{visit.communityName}</span>
                    ) : null}
                    {visit.siteLine ? <span>{visit.siteLine}</span> : null}
                  </span>
                </p>
              ) : null}

              {visit.notes || visit.customerFieldNotes ? (
                <div className={styles.fieldJobNotes}>
                  {visit.notes ? <p>{visit.notes}</p> : null}
                  {visit.customerFieldNotes ? <p>{visit.customerFieldNotes}</p> : null}
                </div>
              ) : null}

              <div className={styles.fieldJobCardActions}>
                {mapsQuery ? (
                  <a
                    href={mapsQuery}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.fieldJobDirections}
                  >
                    <Navigation size={18} aria-hidden />
                    Directions
                  </a>
                ) : null}
                {action ? (
                  <Link href={action.href} className={styles.fieldJobPrimaryAction}>
                    {action.label}
                  </Link>
                ) : null}
              </div>

              <div className={styles.fieldJobLinks}>
                {phoneHref ? (
                  <a href={phoneHref} className={styles.fieldJobLink}>
                    <Phone size={16} aria-hidden />
                    Call
                  </a>
                ) : null}
                <Link href={`/schedule/${visit.id}`} className={styles.fieldJobLink}>
                  Details
                </Link>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
