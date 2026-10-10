'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { FillScheduleUndo, FillUndoKeptList } from './FillScheduleUndo';
import {
  fillOutcome,
  fillProgressPercent,
  formatFillDate,
  formatFillRange,
  type FillLiveItem,
  type FillRunView,
  type FillUndoResult,
} from './progress';
import styles from './fill-schedule.module.scss';

function crewLabel(item: FillLiveItem): string {
  if (item.staffed === null) return 'Placed, choosing a crew';
  if (item.crewNames.length > 0) return item.crewNames.join(', ');
  return 'Needs a crew';
}

export function FillScheduleRun({
  view,
  active,
  tenantSlug,
  onAnother,
  onUndone,
}: {
  view: FillRunView;
  active: boolean;
  tenantSlug: string;
  onAnother: () => void;
  onUndone: (result: FillUndoResult) => void;
}) {
  const runningRef = useRef<HTMLHeadingElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const finished = view.phase === 'done' || view.phase === 'error';
  const [undoResult, setUndoResult] = useState<FillUndoResult | null>(null);
  const percent = fillProgressPercent(view);
  const range = formatFillRange(view.start, view.end);

  useEffect(() => {
    if (!active) return;
    const node = finished ? doneRef.current : runningRef.current;
    node?.focus();
  }, [active, finished]);

  useEffect(() => {
    if (view.phase !== 'done') setUndoResult(null);
  }, [view.phase, view.summary?.runId]);

  useEffect(() => {
    if (finished) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [finished, view.items.length, view.missed.length]);

  if (view.phase === 'error') {
    return (
      <section className={styles.results} aria-labelledby="fill-result-title">
        <div className={styles.resultsHero}>
          <p className={styles.eyebrow}>Could not finish</p>
          <h2 id="fill-result-title" ref={doneRef} tabIndex={-1} className={styles.resultsTitle}>
            The schedule fill stopped
          </h2>
          <p className={styles.resultsLead}>{view.error}</p>
          <div className={styles.resultActions}>
            <Button type="button" onClick={onAnother}>
              Back to options
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (view.phase === 'done' && view.summary) {
    const outcome =
      undoResult && !undoResult.error
        ? undoCopy(undoResult, view.summary)
        : fillOutcome(view.summary);
    const days = groupByDate(view.items);
    const firstOpen = view.items.find((item) => item.staffed === false);
    const scheduleDate = firstOpen?.dateKey || view.summary.start;
    const undone = Boolean(undoResult && !undoResult.error);

    return (
      <section className={styles.results} aria-labelledby="fill-result-title">
        <div className={styles.resultsHero}>
          <p className={styles.eyebrow}>{undone ? 'Undone' : 'Finished'}</p>
          <h2 id="fill-result-title" ref={doneRef} tabIndex={-1} className={styles.resultsTitle}>
            {outcome.title}
          </h2>
          <p className={styles.resultsLead}>{outcome.lead}</p>
          {undone ? null : (
            <dl className={styles.stats}>
              <div>
                <dt>Placed</dt>
                <dd>{view.summary.created}</dd>
              </div>
              <div>
                <dt>With a crew</dt>
                <dd>{view.summary.assigned}</dd>
              </div>
              <div>
                <dt>Still open</dt>
                <dd>{view.summary.open}</dd>
              </div>
              <div>
                <dt>Left off</dt>
                <dd>{view.summary.skipped}</dd>
              </div>
            </dl>
          )}
          <div className={styles.resultActions}>
            {view.summary.created > 0 && !undone ? (
              <Button as={Link} href={`/schedule?date=${scheduleDate}`}>
                {firstOpen ? 'Review open visits' : 'View on the schedule'}
              </Button>
            ) : (
              <Button as={Link} href={`/schedule?date=${view.summary.start}`}>
                Back to the schedule
              </Button>
            )}
            {view.summary.runId && view.summary.created > 0 && !undone ? (
              <FillScheduleUndo
                tenantSlug={tenantSlug}
                offer={{
                  runId: view.summary.runId,
                  start: view.summary.start,
                  end: view.summary.end,
                  visitCount: view.summary.created,
                }}
                onUndone={(result) => {
                  setUndoResult(result);
                  onUndone(result);
                }}
              />
            ) : null}
            <Button type="button" variant="secondary" onClick={onAnother}>
              Fill another period
            </Button>
          </div>
        </div>

        {undone ? <FillUndoKeptList kept={undoResult?.kept ?? []} /> : null}

        {!undone && days.length > 0 ? (
          <div className={styles.dayGroups}>
            {days.map(([dateKey, items]) => (
              <section key={dateKey} className={styles.day} aria-labelledby={`fill-day-${dateKey}`}>
                <h3 id={`fill-day-${dateKey}`}>
                  <Link href={`/schedule?date=${dateKey}`}>{formatFillDate(dateKey)}</Link>
                </h3>
                <ul className={styles.visitList}>
                  {items.map((item) => (
                    <li key={item.visitId} className={styles.visit}>
                      <div className={styles.visitWhen}>
                        <span>{item.timeLabel}</span>
                        {item.kind === 'consultation' ? (
                          <StatusPill tone="info">Consultation</StatusPill>
                        ) : null}
                      </div>
                      <div className={styles.visitMain}>
                        <p className={styles.visitCustomer}>
                          {item.customerId ? (
                            <Link href={`/customers/${item.customerId}`}>{item.customerName}</Link>
                          ) : (
                            item.customerName
                          )}
                        </p>
                        <p className={styles.visitTitle}>{item.title}</p>
                        <p
                          className={styles.visitCrew}
                          data-open={item.staffed === false || undefined}
                        >
                          {crewLabel(item)}
                          {item.note && item.staffed === false ? ` — ${item.note}` : ''}
                        </p>
                      </div>
                      <Link href={`/schedule/${item.visitId}`} className={styles.visitAction}>
                        {item.staffed === false ? 'Assign crew' : 'Open visit'}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        {view.missed.length > 0 ? (
          <div className={styles.notes}>
            <h3>Could not place</h3>
            <ul>
              {view.missed.map((miss) => (
                <li key={`${miss.label}-${miss.reason}`}>
                  <strong>{miss.label}.</strong> {miss.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {view.skipped.length > 0 ? (
          <div className={styles.notes}>
            <h3>Left off</h3>
            <ul>
              {view.skipped.map((skip) => (
                <li key={`${skip.label}-${skip.reason}`}>
                  <strong>{skip.label}.</strong> {skip.reason}
                </li>
              ))}
            </ul>
            {view.summary.skipped > view.skipped.length ? (
              <p>
                {view.summary.skipped - view.skipped.length} more{' '}
                {view.summary.skipped - view.skipped.length === 1 ? 'job was' : 'jobs were'} left
                off for the same kinds of reasons.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  const settled = view.placedCount + view.missed.length;
  const progressText =
    view.total > 0 && (view.phase === 'placing' || view.phase === 'preparing')
      ? `${settled} of ${view.total} ${view.total === 1 ? 'visit' : 'visits'}`
      : view.phase === 'assigning' && view.assignTotal > 0
        ? `Crew for ${view.assignDone} of ${view.assignTotal} ${view.assignTotal === 1 ? 'day' : 'days'}`
        : 'Working';

  return (
    <section className={styles.running} aria-labelledby="fill-running-title">
      <p className={styles.eyebrow}>In progress</p>
      <h2 id="fill-running-title" ref={runningRef} tabIndex={-1}>
        Filling the schedule
      </h2>
      <p className={styles.runningRange}>{range || 'Checking accepted quotes and new leads.'}</p>
      <p className={styles.runningMessage} aria-live="polite">
        {view.message}
      </p>
      <div
        className={styles.meter}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={progressText}
        data-indeterminate={view.total === 0 || undefined}
      >
        <span style={view.total === 0 ? undefined : { width: `${percent}%` }} />
      </div>
      <p className={styles.meterLabel}>{progressText}</p>

      {view.items.length > 0 || view.missed.length > 0 ? (
        <ul ref={listRef} className={styles.activity} aria-label="Visits placed so far">
          {view.items.map((item) => (
            <li
              key={item.visitId}
              className={styles.activityItem}
              data-staffed={item.staffed === true || undefined}
            >
              <span className={styles.activityTime}>{item.timeLabel}</span>
              <span className={styles.activityBody}>
                <strong>{item.customerName}</strong>
                <span>
                  {item.title}
                  {item.kind === 'consultation' ? ' · consultation' : ''}
                </span>
                <span className={styles.activityMeta}>{crewLabel(item)}</span>
              </span>
              <span className={styles.activityDate}>{formatFillDate(item.dateKey, 'short')}</span>
            </li>
          ))}
          {view.missed.map((miss) => (
            <li
              key={`${miss.label}-${miss.reason}`}
              className={styles.activityItem}
              data-miss="true"
            >
              <span className={styles.activityBody}>
                <strong>{miss.label}</strong>
                <span>{miss.reason}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <div className={styles.waiting} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </section>
  );
}

function undoCopy(
  result: FillUndoResult,
  summary: { start: string; end: string; consultations: number },
): { title: string; lead: string } {
  const range = formatFillRange(summary.start, summary.end);
  const removed = `${result.removed} ${result.removed === 1 ? 'visit is' : 'visits are'} off the calendar`;
  const leads =
    summary.consultations > 0
      ? ' Website leads from the consultations that were removed can be booked again.'
      : '';
  if (result.kept.length === 0) {
    return {
      title: 'That scheduling run was undone',
      lead: `${removed} for ${range}.${leads}`,
    };
  }
  const stayed = `${result.kept.length} ${result.kept.length === 1 ? 'visit stayed' : 'visits stayed'} because ${result.kept.length === 1 ? 'it had' : 'they had'} already moved on.`;
  return {
    title: 'Part of that run was undone',
    lead: `${removed} for ${range}. ${stayed}`,
  };
}

function groupByDate(items: FillLiveItem[]): Array<[string, FillLiveItem[]]> {
  const groups = new Map<string, FillLiveItem[]>();
  for (const item of items) {
    const rows = groups.get(item.dateKey) ?? [];
    rows.push(item);
    groups.set(item.dateKey, rows);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, rows]) => [dateKey, rows.slice().sort((a, b) => a.startMin - b.startMin)]);
}
