'use client';

import Link from 'next/link';
import { ChevronRight, MapPin, Phone } from 'lucide-react';
import { VisitStatusPill } from './VisitStatusPill';
import { formatVisitTimeRange } from './scheduleTimelineUtils';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import type { ScheduleVisitVM } from './TenantScheduleClient';
import styles from './schedule.module.scss';

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

        return (
          <li key={visit.id}>
            <Link href={`/schedule/${visit.id}`} className={styles.fieldJobCard}>
              <div className={styles.fieldJobCardHeader}>
                <div className={styles.fieldJobCardTime}>
                  {formatVisitTimeRange(visit.starts_at, visit.ends_at, tenantTimezone)}
                </div>
                <VisitStatusPill status={visit.status} />
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
              <div className={styles.fieldJobCardFooter}>
                {isNextUp ? <span className={styles.fieldJobNextBadge}>Up next</span> : null}
                <span className={styles.fieldJobOpen}>
                  Open job
                  <ChevronRight size={16} aria-hidden />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
