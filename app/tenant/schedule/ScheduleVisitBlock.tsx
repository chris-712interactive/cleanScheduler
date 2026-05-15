'use client';

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ClipboardList, FileText, Phone } from 'lucide-react';
import { ScheduleAssigneeAvatars } from '@/components/schedule/ScheduleAssigneeAvatars';
import { resolveVisitExpandDirection } from './scheduleTimelineUtils';
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

function visitCardPositionStyle(
  expanded: boolean,
  expandDir: 'up' | 'down',
  topPct: number,
  heightPct: number,
): CSSProperties {
  if (!expanded) {
    return {
      top: `${topPct}%`,
      height: `${heightPct}%`,
      minHeight: '64px',
    };
  }

  const slotEndPct = topPct + heightPct;
  if (expandDir === 'up') {
    return {
      top: 'auto',
      bottom: `${Math.max(0, 100 - slotEndPct)}%`,
      height: 'auto',
    };
  }

  return {
    top: `${topPct}%`,
    bottom: 'auto',
    height: 'auto',
  };
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
  const cardRef = useRef<HTMLElement>(null);
  const [expandDir, setExpandDir] = useState<'up' | 'down'>(() =>
    resolveVisitExpandDirection(topPct, heightPct),
  );

  const timeLabel = formatTimeRange(visit.starts_at, visit.ends_at);
  const durationLabel = formatDurationLabel(visit.starts_at, visit.ends_at);
  const serviceLabel = visit.quoteTitle?.trim() || visit.title?.trim() || 'Service visit';

  useEffect(() => {
    if (expanded) {
      setExpandDir(resolveVisitExpandDirection(topPct, heightPct));
    }
  }, [expanded, topPct, heightPct, visit.id]);

  useLayoutEffect(() => {
    if (!expanded || !cardRef.current) return;

    const track = cardRef.current.parentElement;
    if (!track) return;

    const trackRect = track.getBoundingClientRect();
    const cardRect = cardRef.current.getBoundingClientRect();
    const overflowsBottom = cardRect.bottom > trackRect.bottom + 2;
    const overflowsTop = cardRect.top < trackRect.top + 2;

    setExpandDir((prev) => {
      if (overflowsBottom && prev === 'down') return 'up';
      if (overflowsTop && prev === 'up') return 'down';
      return prev;
    });
  }, [expanded, expandDir, topPct, heightPct]);

  const cardClass = [
    styles.visitCard,
    expanded ? styles.visitCardExpanded : '',
    expanded && expandDir === 'up' ? styles.visitCardExpandUp : '',
    expanded && expandDir === 'down' ? styles.visitCardExpandDown : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <article
      ref={cardRef}
      className={cardClass}
      style={visitCardPositionStyle(expanded, expandDir, topPct, heightPct)}
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
                {expandDir === 'up' ? (
                  <ChevronDown size={18} aria-hidden="true" />
                ) : (
                  <ChevronUp size={18} aria-hidden="true" />
                )}
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
