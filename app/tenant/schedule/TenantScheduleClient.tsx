'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ScheduleView } from '@/lib/tenant/scheduleDateRange';
import {
  buildUtcMonthGrid,
  shiftDateKey,
  shiftDateKeyByMonths,
  visitOverlapsUtcCalendarDay,
} from '@/lib/tenant/scheduleDateRange';
import {
  currentTimeLinePct,
  formatLocalYmd,
  hourLabels,
  layoutVisitOnLocalDay,
  visitOverlapsLocalDay,
} from './scheduleTimelineUtils';
import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';
import { VisitStatusPill } from './VisitStatusPill';
import { ScheduleVisitBlock } from './ScheduleVisitBlock';
import styles from './schedule.module.scss';

export type ScheduleVisitVM = {
  id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes: string | null;
  customerName: string;
  customerPhone: string | null;
  siteLine: string;
  quoteTitle: string | null;
  assignees: ScheduleAssigneeChip[];
};

function formatTimeRange(startsAt: string, endsAt: string): string {
  const s = new Date(startsAt);
  const e = new Date(endsAt);
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return `${s.toLocaleString(undefined, opts)} – ${e.toLocaleString(undefined, opts)}`;
}

export function TenantScheduleClient({
  visits,
  dateKey,
  view,
  weekDayKeys,
}: {
  tenantSlug: string;
  visits: ScheduleVisitVM[];
  dateKey: string;
  view: ScheduleView;
  weekDayKeys: string[];
}) {
  const router = useRouter();
  const [, setNowTick] = useState(0);
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setExpandedVisitId(null);
  }, [dateKey, view]);

  const push = (next: { date?: string; view?: ScheduleView }) => {
    const params = new URLSearchParams();
    params.set('date', next.date ?? dateKey);
    params.set('view', next.view ?? view);
    router.push(`/schedule?${params.toString()}`);
  };

  const todayKey = formatLocalYmd(new Date());
  const isLocalToday = dateKey === todayKey;

  const centerLabel = useMemo(() => {
    const anchor = new Date(`${dateKey}T12:00:00`);
    const long = anchor.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    return isLocalToday ? `Today, ${long}` : long;
  }, [dateKey, isLocalToday]);

  const dayVisits = useMemo(
    () =>
      visits
        .filter((v) => visitOverlapsLocalDay(v, dateKey))
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [visits, dateKey],
  );

  const hours = useMemo(() => hourLabels(), []);
  const nowLinePct = currentTimeLinePct(dateKey);
  const monthCells = useMemo(() => buildUtcMonthGrid(dateKey), [dateKey]);

  const goPrev = () => {
    if (view === 'month') push({ date: shiftDateKeyByMonths(dateKey, -1) });
    else if (view === 'week') push({ date: shiftDateKey(dateKey, -7) });
    else push({ date: shiftDateKey(dateKey, -1) });
  };

  const goNext = () => {
    if (view === 'month') push({ date: shiftDateKeyByMonths(dateKey, 1) });
    else if (view === 'week') push({ date: shiftDateKey(dateKey, 7) });
    else push({ date: shiftDateKey(dateKey, 1) });
  };

  return (
    <div className={styles.scheduleShell}>
      <div className={styles.scheduleToolbar}>
        <div className={styles.scheduleDateNav}>
          <button
            type="button"
            className={styles.iconNavBtn}
            aria-label="Previous"
            onClick={goPrev}
          >
            <ChevronLeft size={20} />
          </button>
          <span className={styles.scheduleDateLabel}>{centerLabel}</span>
          <button type="button" className={styles.iconNavBtn} aria-label="Next" onClick={goNext}>
            <ChevronRight size={20} />
          </button>
          <button
            type="button"
            className={styles.todayLink}
            onClick={() => push({ date: todayKey })}
          >
            Today
          </button>
        </div>
        <div className={styles.viewToggle} role="group" aria-label="Calendar view">
          {(['day', 'week', 'month'] as const).map((v) => (
            <button
              key={v}
              type="button"
              className={view === v ? styles.viewToggleBtnActive : styles.viewToggleBtn}
              onClick={() => push({ view: v })}
            >
              {v === 'day' ? 'Day' : v === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.scheduleFilters}>
        <select className={styles.filterSelect} disabled aria-label="Employee filter">
          <option>All employees</option>
        </select>
        <select className={styles.filterSelect} disabled aria-label="Service filter">
          <option>All services</option>
        </select>
      </div>

      {view === 'day' ? (
        <div
          className={[styles.dayBoard, expandedVisitId ? styles.dayBoardExpanded : '']
            .filter(Boolean)
            .join(' ')}
        >
          <div className={styles.hourRail}>
            {hours.map((h) => (
              <div key={h.hour} className={styles.hourTick}>
                {h.label}
              </div>
            ))}
          </div>
          <div
            className={[
              styles.timelineTrack,
              expandedVisitId ? styles.timelineTrackExpanded : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {hours.map((h) => (
              <div key={h.hour} className={styles.hourLine} />
            ))}
            {nowLinePct !== null ? (
              <div className={styles.nowLine} style={{ top: `${nowLinePct}%` }} aria-hidden="true">
                <span className={styles.nowDot} />
              </div>
            ) : null}
            {dayVisits.map((v) => {
              const { topPct, heightPct, visible } = layoutVisitOnLocalDay(v, dateKey);
              if (!visible) return null;
              return (
                <ScheduleVisitBlock
                  key={v.id}
                  visit={v}
                  topPct={topPct}
                  heightPct={heightPct}
                  expanded={expandedVisitId === v.id}
                  onToggle={() =>
                    setExpandedVisitId((current) => (current === v.id ? null : v.id))
                  }
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {view === 'week' ? (
        <div className={styles.weekBoard}>
          {weekDayKeys.map((k) => {
            const dayVisitsWeek = visits
              .filter((v) => visitOverlapsUtcCalendarDay(v, k))
              .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
            const label = new Date(`${k}T12:00:00.000Z`).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            return (
              <div key={k} className={styles.weekColumn}>
                <div className={styles.weekColumnHead}>{label}</div>
                <ul className={styles.weekList}>
                  {dayVisitsWeek.length === 0 ? (
                    <li className={styles.weekEmpty}>—</li>
                  ) : (
                    dayVisitsWeek.map((v) => (
                      <li key={v.id}>
                        <Link href={`/schedule/${v.id}`} className={styles.weekItem}>
                          <span className={styles.weekItemTop}>
                            <span className={styles.weekItemTitle}>{v.customerName}</span>
                            <VisitStatusPill status={v.status} />
                          </span>
                          <span className={styles.weekItemMeta}>
                            {formatTimeRange(v.starts_at, v.ends_at)}
                          </span>
                        </Link>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            );
          })}
        </div>
      ) : null}

      {view === 'month' ? (
        <div className={styles.monthBoard}>
          <div className={styles.monthWeekdayRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className={styles.monthWeekday}>
                {d}
              </div>
            ))}
          </div>
          <div className={styles.monthGrid}>
            {monthCells.map((cell) => {
              const n = visits.filter((v) => visitOverlapsUtcCalendarDay(v, cell.key)).length;
              const inView = cell.key === dateKey;
              return (
                <button
                  key={cell.key}
                  type="button"
                  className={[
                    styles.monthCell,
                    !cell.inMonth ? styles.monthCellMuted : '',
                    inView ? styles.monthCellActive : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => push({ date: cell.key, view: 'day' })}
                >
                  <span className={styles.monthCellDay}>{cell.day}</span>
                  {n > 0 ? (
                    <span className={styles.monthCellDots}>{n > 3 ? '···' : '●'.repeat(n)}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {view === 'day' && dayVisits.length === 0 ? (
        <p className={styles.emptyBoard}>
          No appointments on this day. Use New appointment to add one.
        </p>
      ) : null}
    </div>
  );
}
