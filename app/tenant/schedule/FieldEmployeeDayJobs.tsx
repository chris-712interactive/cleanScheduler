'use client';

import Link from 'next/link';
import { ChevronRight, MapPin, Phone } from 'lucide-react';
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
          {isLocalToday ? 'No jobs scheduled for today' : 'No jobs on this day'}
        </p>
        <p className={styles.fieldJobEmptyHint}>
          When your office assigns visits to you, they appear here as easy-to-tap cards.
        </p>
      </div>
    );
  }

  return (
    <ul className={styles.fieldJobList}>
      {visits.map((visit) => {
        const serviceLabel = visit.quoteTitle?.trim() || visit.title?.trim() || 'Cleaning visit';
        const isNextUp =
          isLocalToday &&
          visit.status === 'scheduled' &&
          new Date(visit.ends_at).getTime() >= Date.now();
        const action = primaryAction(visit);
        const mapsQuery = visit.siteLine?.trim()
          ? `https://maps.google.com/?q=${encodeURIComponent(visit.siteLine)}`
          : null;
        const phoneHref = visit.customerPhone
          ? `tel:${visit.customerPhone.replace(/\s/g, '')}`
          : null;

        return (
          <li key={visit.id} className={styles.fieldJobCardShell}>
            <div className={styles.fieldJobCard}>
              <div className={styles.fieldJobCardHeader}>
                <div className={styles.fieldJobCardTime}>
                  {formatVisitTimeRange(visit.starts_at, visit.ends_at, tenantTimezone)}
                </div>
                <span
                  className={styles.fieldJobStatusChip}
                  data-status={visit.status}
                  data-checked-in={visit.checkedInAt ? 'true' : 'false'}
                >
                  {fieldStatusLabel(visit)}
                </span>
              </div>
              <h3 className={styles.fieldJobCardCustomer}>{visit.customerName}</h3>
              <p className={styles.fieldJobCardService}>{serviceLabel}</p>
              {visit.expectedAmountCents != null ? (
                <p className={styles.fieldJobCardMeta}>
                  Job amount: ${formatCentsAsDollars(visit.expectedAmountCents)}
                </p>
              ) : null}
              {visit.siteLine ? (
                <p className={styles.fieldJobCardMeta}>
                  <MapPin size={16} aria-hidden className={styles.fieldJobCardIcon} />
                  {visit.siteLine}
                </p>
              ) : null}
              {visit.customerPhone ? (
                <p className={styles.fieldJobCardMeta}>
                  <Phone size={16} aria-hidden className={styles.fieldJobCardIcon} />
                  <span>{visit.customerPhone}</span>
                </p>
              ) : null}
              <div className={styles.fieldJobCardActions}>
                {action ? (
                  <Link href={action.href} className={styles.fieldJobPrimaryAction}>
                    {action.label}
                    <ChevronRight size={16} aria-hidden />
                  </Link>
                ) : null}
                <div className={styles.fieldJobSecondaryActions}>
                  {phoneHref ? (
                    <a href={phoneHref} className={styles.fieldJobSecondaryAction}>
                      Call
                    </a>
                  ) : null}
                  {mapsQuery ? (
                    <a
                      href={mapsQuery}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.fieldJobSecondaryAction}
                    >
                      Maps
                    </a>
                  ) : null}
                  <Link href={`/schedule/${visit.id}`} className={styles.fieldJobSecondaryAction}>
                    Details
                  </Link>
                </div>
              </div>
              {isNextUp ? <span className={styles.fieldJobNextBadge}>Up next</span> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
