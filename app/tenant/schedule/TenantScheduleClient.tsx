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
  formatVisitTimeRange,
  hourLabels,
  layoutVisitOnLocalDay,
  resolveTimelineWindow,
  visitOverlapsLocalDay,
} from './scheduleTimelineUtils';
import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';
import { VisitStatusPill } from './VisitStatusPill';
import { ScheduleVisitBlock } from './ScheduleVisitBlock';
import { FieldEmployeeDayJobs } from './FieldEmployeeDayJobs';
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
  expectedAmountCents: number | null;
  assignees: ScheduleAssigneeChip[];
  assigneeUserIds: string[];
};

export function TenantScheduleClient({
  visits,
  dateKey,
  view,
  weekDayKeys,
  employeeFilter,
  employeeOptions,
  currentUserId,
  fieldEmployeeMode = false,
}: {
  tenantSlug: string;
  visits: ScheduleVisitVM[];
  dateKey: string;
  view: ScheduleView;
  weekDayKeys: string[];
  employeeFilter: string;
  employeeOptions: { id: string; label: string }[];
  currentUserId: string;
  fieldEmployeeMode?: boolean;
}) {
  const router = useRouter();
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
  const [nowLinePct, setNowLinePct] = useState<number | null>(null);

  useEffect(() => {
    setExpandedVisitId(null);
  }, [dateKey, view]);

  const push = (next: { date?: string; view?: ScheduleView; employee?: string }) => {
    const params = new URLSearchParams();
    params.set('date', next.date ?? dateKey);
    params.set('view', next.view ?? view);
    const employee = next.employee ?? employeeFilter;
    if (employee && employee !== 'all') {
      params.set('employee', employee);
    }
    router.push(`/schedule?${params.toString()}`);
  };

  const filteredVisits = useMemo(() => {
    if (employeeFilter === 'all') return visits;
    const targetUserId = employeeFilter === 'me' ? currentUserId : employeeFilter;
    if (!targetUserId) return visits;
    return visits.filter((visit) => visit.assigneeUserIds.includes(targetUserId));
  }, [visits, employeeFilter, currentUserId]);

  const todayKey = formatLocalYmd(new Date());
  const isLocalToday = dateKey === todayKey;
  const showingFieldJobs = fieldEmployeeMode && view === 'today';
  const showingFieldCalendar = fieldEmployeeMode && view !== 'today';

  const centerLabel = useMemo(() => {
    const anchor = new Date(`${dateKey}T12:00:00`);
    const long = anchor.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
    if (showingFieldJobs) {
      return isLocalToday ? `Today · ${long}` : long;
    }
    return isLocalToday ? `Today, ${long}` : long;
  }, [dateKey, isLocalToday, showingFieldJobs]);

  const dayVisits = useMemo(
    () =>
      filteredVisits
        .filter((v) => visitOverlapsLocalDay(v, dateKey))
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    [filteredVisits, dateKey],
  );

  const timelineWindow = useMemo(
    () => resolveTimelineWindow(dateKey, dayVisits),
    [dateKey, dayVisits],
  );

  const hours = useMemo(() => hourLabels(timelineWindow), [timelineWindow]);
  const monthCells = useMemo(() => buildUtcMonthGrid(dateKey), [dateKey]);

  useEffect(() => {
    const updateNowLine = () => {
      setNowLinePct(currentTimeLinePct(dateKey, timelineWindow));
    };

    updateNowLine();
    const id = window.setInterval(updateNowLine, 60_000);
    return () => window.clearInterval(id);
  }, [dateKey, timelineWindow]);

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

  const prevLabel =
    view === 'month' ? 'Previous month' : view === 'week' ? 'Previous week' : 'Previous day';
  const nextLabel = view === 'month' ? 'Next month' : view === 'week' ? 'Next week' : 'Next day';

  return (
    <div className={styles.scheduleShell}>
      <div className={styles.scheduleControlBar}>
        <div className={styles.scheduleDateNav}>
          <button
            type="button"
            className={styles.iconNavBtn}
            aria-label={prevLabel}
            onClick={goPrev}
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </button>
          <div className={styles.scheduleDateCenter}>
            <span className={styles.scheduleDateLabel}>{centerLabel}</span>
            {!isLocalToday ? (
              <button
                type="button"
                className={styles.todayLink}
                onClick={() => push({ date: todayKey, view: fieldEmployeeMode ? 'today' : view })}
              >
                Jump to today
              </button>
            ) : null}
          </div>
          <button
            type="button"
            className={styles.iconNavBtn}
            aria-label={nextLabel}
            onClick={goNext}
          >
            <ChevronRight size={20} aria-hidden="true" />
          </button>
        </div>

        {fieldEmployeeMode ? (
          <div className={styles.viewToggle} role="group" aria-label="Schedule view">
            <button
              type="button"
              className={view === 'today' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
              onClick={() => push({ view: 'today', date: isLocalToday ? dateKey : todayKey })}
            >
              My jobs
            </button>
            <button
              type="button"
              className={view !== 'today' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
              onClick={() => push({ view: 'week' })}
            >
              Calendar
            </button>
          </div>
        ) : (
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
        )}
      </div>

      {showingFieldCalendar ? (
        <div className={styles.fieldBrowseBar}>
          <button
            type="button"
            className={styles.fieldBrowseBack}
            onClick={() => push({ view: 'today' })}
          >
            ← Back to job list
          </button>
          <div className={styles.fieldBrowseViews} role="group" aria-label="Calendar range">
            <button
              type="button"
              className={view === 'week' ? styles.fieldBrowseViewActive : styles.fieldBrowseView}
              onClick={() => push({ view: 'week' })}
            >
              Week
            </button>
            <button
              type="button"
              className={view === 'month' ? styles.fieldBrowseViewActive : styles.fieldBrowseView}
              onClick={() => push({ view: 'month' })}
            >
              Month
            </button>
          </div>
        </div>
      ) : null}

      {!fieldEmployeeMode ? (
        <div className={styles.scheduleFilters}>
          <label className={styles.scheduleFilterField}>
            <span className={styles.scheduleFilterLabel}>Crew member</span>
            <select
              className={styles.filterSelect}
              aria-label="Employee filter"
              value={employeeFilter}
              onChange={(event) => push({ employee: event.target.value })}
            >
              <option value="all">All crew</option>
              <option value="me">My jobs</option>
              {employeeOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      {showingFieldJobs ? (
        <FieldEmployeeDayJobs visits={dayVisits} isLocalToday={isLocalToday} />
      ) : null}

      {view === 'day' && !showingFieldJobs ? (
        <div
          className={[styles.dayBoard, expandedVisitId ? styles.dayBoardExpanded : '']
            .filter(Boolean)
            .join(' ')}
          style={{ minHeight: `${Math.max(480, hours.length * 56)}px` }}
        >
          <div className={styles.hourRail}>
            {hours.map((h) => (
              <div key={h.hour} className={styles.hourTick}>
                {h.label}
              </div>
            ))}
          </div>
          <div
            className={[styles.timelineTrack, expandedVisitId ? styles.timelineTrackExpanded : '']
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
              const { topPct, heightPct, visible } = layoutVisitOnLocalDay(
                v,
                dateKey,
                timelineWindow,
              );
              if (!visible) return null;
              return (
                <ScheduleVisitBlock
                  key={v.id}
                  visit={v}
                  topPct={topPct}
                  heightPct={heightPct}
                  expanded={expandedVisitId === v.id}
                  onToggle={() => setExpandedVisitId((current) => (current === v.id ? null : v.id))}
                />
              );
            })}
          </div>
        </div>
      ) : null}

      {view === 'week' && showingFieldCalendar ? (
        <div className={styles.weekBoard}>
          {weekDayKeys.map((k) => {
            const dayVisitsWeek = filteredVisits
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
                            {formatVisitTimeRange(v.starts_at, v.ends_at)}
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

      {view === 'week' && !fieldEmployeeMode ? (
        <div className={styles.weekBoard}>
          {weekDayKeys.map((k) => {
            const dayVisitsWeek = filteredVisits
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
                            {formatVisitTimeRange(v.starts_at, v.ends_at)}
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
              const n = filteredVisits.filter((v) =>
                visitOverlapsUtcCalendarDay(v, cell.key),
              ).length;
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
                  onClick={() =>
                    push({
                      date: cell.key,
                      view: fieldEmployeeMode ? 'today' : 'day',
                    })
                  }
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

      {view === 'day' && !showingFieldJobs && dayVisits.length === 0 ? (
        <p className={styles.emptyBoard}>
          No appointments on this day. Use New appointment to add one.
        </p>
      ) : null}
    </div>
  );
}
