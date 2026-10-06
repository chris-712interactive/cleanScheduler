import Link from 'next/link';
import type { EmployeeScheduleDay } from '@/lib/schedule/employeeWeekSchedule';
import styles from './employeeEdit.module.scss';

export function EmployeeWeekSchedule({
  displayName,
  userId,
  weekLabel,
  prevWeek,
  nextWeek,
  days,
  laterTimeOff,
}: {
  displayName: string;
  userId: string;
  weekLabel: string;
  prevWeek: string;
  nextWeek: string;
  days: EmployeeScheduleDay[];
  laterTimeOff: { dateKey: string; status: 'pending' | 'approved' } | null;
}) {
  return (
    <section
      id="member-schedule"
      className={styles.schedulePanel}
      aria-labelledby="schedule-heading"
    >
      <header className={styles.scheduleHeader}>
        <div>
          <h3 id="schedule-heading" className={styles.panelTitle}>
            Schedule
          </h3>
          <p className={styles.panelLead}>
            Jobs and time off for {displayName}. A dotted outline means the request still needs
            review.
          </p>
        </div>
        <div className={styles.scheduleNav}>
          <Link className={styles.scheduleNavLink} href={`/employees/${userId}?week=${prevWeek}`}>
            Previous week
          </Link>
          <span className={styles.scheduleWeekLabel}>{weekLabel}</span>
          <Link className={styles.scheduleNavLink} href={`/employees/${userId}?week=${nextWeek}`}>
            Next week
          </Link>
        </div>
      </header>

      <ul className={styles.scheduleLegend}>
        <li>
          <span className={styles.legendSwatch} data-kind="job" aria-hidden />
          Job
        </li>
        <li>
          <span className={styles.legendSwatch} data-kind="approved" aria-hidden />
          Approved time off
        </li>
        <li>
          <span className={styles.legendSwatch} data-kind="requested" aria-hidden />
          Requested time off
        </li>
      </ul>

      <div className={styles.scheduleBoard}>
        {days.map((day) => (
          <div
            key={day.dateKey}
            className={[styles.scheduleDay, day.isToday ? styles.scheduleDayToday : '']
              .filter(Boolean)
              .join(' ')}
          >
            <div className={styles.scheduleDayHead}>{day.label}</div>
            <ul className={styles.scheduleDayList}>
              {day.blocks.length === 0 ? <li className={styles.scheduleEmpty}>—</li> : null}
              {day.blocks.map((block) =>
                block.kind === 'visit' ? (
                  <li key={`visit-${block.id}`}>
                    <Link href={`/schedule/${block.id}`} className={styles.scheduleJob}>
                      <span className={styles.scheduleBlockTitle}>{block.customerName}</span>
                      <span className={styles.scheduleBlockMeta}>{block.timeLabel}</span>
                      {block.title ? (
                        <span className={styles.scheduleBlockMeta}>{block.title}</span>
                      ) : null}
                    </Link>
                  </li>
                ) : (
                  <li key={`off-${block.id}-${day.dateKey}`}>
                    {block.status === 'pending' ? (
                      <Link
                        href="/schedule/time-off-requests"
                        className={styles.scheduleTimeOff}
                        data-status="pending"
                      >
                        <span className={styles.scheduleBlockTitle}>Time off requested</span>
                        <span className={styles.scheduleBlockMeta}>{block.timeLabel}</span>
                        {block.note ? (
                          <span className={styles.scheduleBlockMeta}>{block.note}</span>
                        ) : null}
                      </Link>
                    ) : (
                      <div className={styles.scheduleTimeOff} data-status="approved">
                        <span className={styles.scheduleBlockTitle}>Time off</span>
                        <span className={styles.scheduleBlockMeta}>{block.timeLabel}</span>
                        {block.note ? (
                          <span className={styles.scheduleBlockMeta}>{block.note}</span>
                        ) : null}
                      </div>
                    )}
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>

      {laterTimeOff ? (
        <p className={styles.scheduleLater}>
          <Link href={`/employees/${userId}?week=${laterTimeOff.dateKey}`}>
            {laterTimeOff.status === 'pending'
              ? 'A later time off request is outside this week.'
              : 'Approved time off continues outside this week.'}
          </Link>
        </p>
      ) : null}
    </section>
  );
}
