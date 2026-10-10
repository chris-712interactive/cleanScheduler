'use client';

import { useActionState, useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FillScheduleRun } from './FillScheduleRun';
import { FillScheduleUndo } from './FillScheduleUndo';
import { fillScheduleAction } from './actions';
import {
  applyFillProgress,
  formatFillRange,
  INITIAL_FILL_RUN,
  type FillProgressEvent,
  type FillRunView,
  type FillScheduleState,
  type FillUndoOffer,
  type FillUndoResult,
} from './progress';
import styles from './fill-schedule.module.scss';

const INITIAL: FillScheduleState = {};

export function FillScheduleForm({
  tenantSlug,
  anchorDate,
  undoableRuns,
}: {
  tenantSlug: string;
  anchorDate: string;
  undoableRuns: FillUndoOffer[];
}) {
  const [state, action, pending] = useActionState(fillScheduleAction, INITIAL);
  const [step, setStep] = useState<'form' | 'status'>('form');
  const [offers, setOffers] = useState(undoableRuns);
  const [undoNote, setUndoNote] = useState('');
  const { view, enqueue, reset } = usePacedFill(step === 'status');
  useEffect(() => {
    const summary = view.summary;
    const runId = summary?.runId;
    if (view.phase !== 'done' || !summary || !runId || summary.created === 0) return;
    setOffers((current) => {
      if (current.some((offer) => offer.runId === runId)) return current;
      return [
        {
          runId,
          start: summary.start,
          end: summary.end,
          visitCount: summary.created,
        },
        ...current,
      ].slice(0, 3);
    });
  }, [view.phase, view.summary]);

  function handleUndone(result: FillUndoResult) {
    if (result.error) return;
    setOffers((current) => current.filter((offer) => offer.runId !== result.runId));
    const stayed =
      result.kept.length === 0
        ? ''
        : ` ${result.kept.length} ${result.kept.length === 1 ? 'visit stayed' : 'visits stayed'} because ${result.kept.length === 1 ? 'it had' : 'they had'} already moved on.`;
    setUndoNote(
      `Removed ${result.removed} ${result.removed === 1 ? 'visit' : 'visits'} from that run.${stayed}`,
    );
  }

  const formRef = useRef<HTMLFormElement>(null);
  const running = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  async function scheduleThese() {
    const form = formRef.current;
    if (!form || running.current || pending) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    running.current = true;
    reset();
    setStep('status');
    const data = new FormData(form);
    data.set('intent', 'commit');
    try {
      const response = await fetch('/schedule/fill/stream', {
        method: 'POST',
        body: data,
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        enqueue({ type: 'error', message: 'The schedule fill did not start.' });
        return;
      }
      await readFillStream(response.body, enqueue);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      enqueue({ type: 'error', message: 'The connection dropped before the schedule finished.' });
    } finally {
      running.current = false;
    }
  }

  return (
    <div className={styles.stage} data-step={step}>
      <form
        ref={formRef}
        action={action}
        className={styles.form}
        inert={step === 'status' ? true : undefined}
      >
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="anchor_date" value={anchorDate} />

        {undoNote ? <p className={styles.undoNote}>{undoNote}</p> : null}
        {offers.map((offer) => (
          <aside key={offer.runId} className={styles.undoBanner}>
            <p>
              <strong>
                {offer.visitCount} {offer.visitCount === 1 ? 'visit' : 'visits'}
              </strong>{' '}
              from the fill for {formatFillRange(offer.start, offer.end)}{' '}
              {offer.visitCount === 1 ? 'is' : 'are'} still on the calendar.
            </p>
            <FillScheduleUndo tenantSlug={tenantSlug} offer={offer} onUndone={handleUndone} />
          </aside>
        ))}

        <fieldset className={styles.scopes}>
          <legend>What should be filled</legend>
          <label>
            <input type="radio" name="scope" value="day" defaultChecked />
            This day ({anchorDate})
          </label>
          <label>
            <input type="radio" name="scope" value="week" />
            This week
          </label>
          <label>
            <input type="radio" name="scope" value="month" />
            This month
          </label>
          <label>
            <input type="radio" name="scope" value="range" />
            Date range
          </label>
        </fieldset>

        <div className={styles.range}>
          <label>
            Start
            <input type="date" name="range_start" defaultValue={anchorDate} />
          </label>
          <label>
            End
            <input type="date" name="range_end" defaultValue={anchorDate} />
          </label>
        </div>

        <div className={styles.actions}>
          <Button type="submit" name="intent" value="preview" variant="secondary" loading={pending}>
            Preview
          </Button>
          <Button type="button" onClick={() => void scheduleThese()} disabled={pending}>
            Schedule these
          </Button>
        </div>

        {state.error ? <p className={styles.error}>{state.error}</p> : null}

        {state.proposals ? (
          <div className={styles.preview}>
            <h2>
              {state.proposals.length} visit{state.proposals.length === 1 ? '' : 's'} from{' '}
              {state.start} through {state.end}
            </h2>
            {state.proposals.length === 0 ? (
              <p>Nothing in this period is due.</p>
            ) : (
              <ul>
                {state.proposals.map((row) => (
                  <li key={row.key}>
                    <strong>{row.dateKey}</strong> {row.timeLabel} — {row.customerName}, {row.title}
                    {row.kind === 'consultation' ? ' (consultation)' : ''}
                  </li>
                ))}
              </ul>
            )}
            {state.skipped && state.skipped.length > 0 ? (
              <div>
                <h3>Left off</h3>
                <ul>
                  {state.skipped.map((skip) => (
                    <li key={`${skip.label}-${skip.reason}`}>
                      {skip.label}: {skip.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </form>

      <div className={styles.status} inert={step === 'form' ? true : undefined}>
        <FillScheduleRun
          view={view}
          active={step === 'status'}
          tenantSlug={tenantSlug}
          onAnother={() => setStep('form')}
          onUndone={handleUndone}
        />
      </div>
    </div>
  );
}

function usePacedFill(active: boolean) {
  const [view, setView] = useState<FillRunView>(INITIAL_FILL_RUN);
  const queueRef = useRef<FillProgressEvent[]>([]);
  const reduceRef = useRef(false);
  const phaseRef = useRef(view.phase);

  useEffect(() => {
    reduceRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const enqueue = useCallback((event: FillProgressEvent) => {
    if (reduceRef.current || event.type === 'error') {
      if (event.type === 'error') queueRef.current = [];
      setView((current) => {
        const next = applyFillProgress(current, event);
        phaseRef.current = next.phase;
        return next;
      });
      return;
    }
    queueRef.current.push(event);
  }, []);

  useEffect(() => {
    if (!active) return;
    let timer = 0;
    let stopped = false;
    const step = () => {
      if (stopped) return;
      const next = queueRef.current.shift();
      if (next) {
        setView((current) => {
          const updated = applyFillProgress(current, next);
          phaseRef.current = updated.phase;
          return updated;
        });
      }
      const waiting = queueRef.current.length;
      if (!next && waiting === 0 && (phaseRef.current === 'done' || phaseRef.current === 'error'))
        return;
      const delay = !next ? 70 : waiting > 24 ? 32 : waiting > 8 ? 70 : 150;
      timer = window.setTimeout(step, delay);
    };
    timer = window.setTimeout(step, 40);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [active]);

  const reset = useCallback(() => {
    queueRef.current = [];
    phaseRef.current = 'preparing';
    setView(INITIAL_FILL_RUN);
  }, []);

  return { view, enqueue, reset };
}

async function readFillStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: FillProgressEvent) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;

  const take = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed || finished) return;
    try {
      const event = JSON.parse(trimmed) as FillProgressEvent;
      if (event.type === 'done' || event.type === 'error') finished = true;
      onEvent(event);
    } catch {
      finished = true;
      onEvent({ type: 'error', message: 'The schedule fill returned something unexpected.' });
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) take(line);
  }
  buffer += decoder.decode();
  if (buffer.trim()) take(buffer);
  if (!finished) onEvent({ type: 'error', message: 'The fill stopped before it finished.' });
}
