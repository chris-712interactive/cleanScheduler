'use client';

import Link from 'next/link';
import { ChevronUp, ClipboardList, FileText, Phone } from 'lucide-react';
import { ScheduleAssigneeAvatars } from '@/components/schedule/ScheduleAssigneeAvatars';
import type { ScheduleVisitVM } from './TenantScheduleClient';
import styles from './schedule.module.scss';

function formatTimeRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${s.toLocaleString(undefined, opts)} – ${e.toLocaleString(undefined, opts)}`;
}

function formatDurationLabel(startsAt: string, endsAt: string): string {
  const hrs = (new Date(endsAt).getTime() - new Date(startsAt).getTime()) / 3_600_000;
  const rounded = Math.round(hrs * 10) / 10;
  if (rounded === 1) return '1 hr';
  return `${rounded} hrs`;
}

export function ScheduleVisitBlock({
  visit,
  topPct,
  heightPct,
  expanded,
  onToggle,
}: {
  visit: ScheduleVisitVM;
  topPct: number;
  heightPct: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const timeLabel = formatTimeRange(visit.starts_at, visit.ends_at);
  const durationLabel = formatDurationLabel(visit.starts_at, visit.ends_at);
  const serviceLabel = visit.quoteTitle?.trim() || visit.title?.trim() || 'Service visit';

  return (
    <article
      className={[styles.visitCard, expanded ? styles.visitCardExpanded : ''].filter(Boolean).join(' ')}
      style={{
        top: `${topPct}%`,
        height: expanded ? 'auto' : `${heightPct}%`,
        minHeight: expanded ? undefined : '64px',
      }}
    >
      <span className={styles.visitAccent} aria-hidden="true" />

      {!expanded ? (
        <button
          type="button"
          className={styles.visitCardButton}
          onClick={onToggle}
          aria-expanded={false}
          aria-label={`${visit.customerName}, ${timeLabel}, expand details`}
        >
          <div className={styles.visitCardMain}>
            <div className={styles.visitCardInfo}>
              <span className={styles.visitCustomer}>{visit.customerName}</span>
              {visit.siteLine ? <span className={styles.visitAddress}>{visit.siteLine}</span> : null}
              <span className={styles.visitTime}>{timeLabel}</span>
            </div>

            {visit.assignees.length > 0 ? (
              <div className={styles.visitCardCrew}>
                <ScheduleAssigneeAvatars
                  assignees={visit.assignees}
                  size="sm"
                  maxVisible={4}
                  layout="row"
                  className={styles.visitCrewRow}
                />
              </div>
            ) : null}
          </div>
        </button>
      ) : (
        <div className={styles.visitCardExpand}>
          <div className={styles.visitExpandHead}>
            <div className={styles.visitExpandHeadText}>
              <span className={styles.visitCustomer}>{visit.customerName}</span>
              {visit.siteLine ? <span className={styles.visitAddress}>{visit.siteLine}</span> : null}
              <span className={styles.visitTime}>
                {timeLabel}
                <span className={styles.visitDuration}> · {durationLabel}</span>
              </span>
            </div>
            <div className={styles.visitExpandHeadAside}>
              {visit.assignees.length > 0 ? (
                <ScheduleAssigneeAvatars
                  assignees={visit.assignees}
                  size="md"
                  maxVisible={4}
                  layout="row"
                  className={styles.visitCrewRow}
                />
              ) : null}
              <button
                type="button"
                className={styles.visitCollapseBtn}
                onClick={onToggle}
                aria-label="Collapse appointment details"
              >
                <ChevronUp size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <ul className={styles.visitDetailList}>
            <li className={styles.visitDetailItem}>
              <ClipboardList size={16} className={styles.visitDetailIcon} aria-hidden="true" />
              <div className={styles.visitDetailCopy}>
                <span className={styles.visitDetailLabel}>Service</span>
                <span className={styles.visitDetailValue}>{serviceLabel}</span>
              </div>
            </li>
            {visit.notes ? (
              <li className={styles.visitDetailItem}>
                <FileText size={16} className={styles.visitDetailIcon} aria-hidden="true" />
                <div className={styles.visitDetailCopy}>
                  <span className={styles.visitDetailLabel}>Notes</span>
                  <span className={styles.visitDetailValue}>{visit.notes}</span>
                </div>
              </li>
            ) : null}
            {visit.customerPhone ? (
              <li className={styles.visitDetailItem}>
                <Phone size={16} className={styles.visitDetailIcon} aria-hidden="true" />
                <div className={styles.visitDetailCopy}>
                  <span className={styles.visitDetailLabel}>Phone</span>
                  <a
                    href={`tel:${visit.customerPhone.replace(/\s/g, '')}`}
                    className={styles.visitDetailLink}
                  >
                    {visit.customerPhone}
                  </a>
                </div>
              </li>
            ) : null}
          </ul>

          <Link href={`/schedule/${visit.id}`} className={styles.visitOpenLink}>
            Open full visit page
          </Link>
        </div>
      )}
    </article>
  );
}
