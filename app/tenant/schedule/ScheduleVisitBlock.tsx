'use client';

import Link from 'next/link';
import type { CSSProperties } from 'react';
import { ScheduleAssigneeAvatars } from '@/components/schedule/ScheduleAssigneeAvatars';
import { formatVisitTime } from '@/lib/datetime/formatInTimeZone';
import { compactCalendarAddress } from '@/lib/tenant/formatPropertyAddress';
import type { ScheduleVisitVM } from './TenantScheduleClient';
import styles from './schedule.module.scss';

function formatTimeRange(startsAt: string, endsAt: string, timeZone: string): string {
  return `${formatVisitTime(startsAt, timeZone)} – ${formatVisitTime(endsAt, timeZone)}`;
}

export function ScheduleVisitBlock({
  visit,
  tenantTimezone,
  topPct,
  heightPct,
  column,
  columnCount,
}: {
  visit: ScheduleVisitVM;
  tenantTimezone: string;
  topPct: number;
  heightPct: number;
  column: number;
  columnCount: number;
}) {
  const timeLabel = formatTimeRange(visit.starts_at, visit.ends_at, tenantTimezone);
  const addressLabel = visit.siteLine ? compactCalendarAddress(visit.siteLine) : '';
  const cardWidth = `min(17rem, calc((100% - (${columnCount} + 1) * var(--space-2)) / ${columnCount}))`;
  const position: CSSProperties = {
    top: `${topPct}%`,
    height: `${heightPct}%`,
    left: `calc(var(--space-2) + ${column} * (${cardWidth} + var(--space-2)))`,
    width: cardWidth,
  };

  return (
    <Link
      href={`/schedule/${visit.id}`}
      className={styles.visitCard}
      style={position}
      aria-label={`${visit.customerName}, ${timeLabel}, open appointment`}
    >
      <span className={styles.visitAccent} aria-hidden="true" />
      <div className={styles.visitCardMain}>
        <div className={styles.visitCardInfo}>
          <span className={styles.visitCustomer}>{visit.customerName}</span>
          <span
            className={[styles.visitAddress, !addressLabel ? styles.visitAddressEmpty : '']
              .filter(Boolean)
              .join(' ')}
            title={visit.siteLine || undefined}
          >
            {addressLabel || 'No address on file'}
          </span>
          <span className={styles.visitTime}>{timeLabel}</span>
        </div>

        {visit.assignees.length > 0 ? (
          <div className={styles.visitCardCrew}>
            <ScheduleAssigneeAvatars
              assignees={visit.assignees}
              size="calendar"
              maxVisible={2}
              layout="row"
              className={styles.visitCrewRow}
            />
          </div>
        ) : null}
      </div>
    </Link>
  );
}
