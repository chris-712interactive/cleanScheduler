'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { undoFillScheduleRun } from './actions';
import { formatFillRange, type FillUndoOffer, type FillUndoResult } from './progress';
import styles from './fill-schedule.module.scss';

export function FillScheduleUndo({
  tenantSlug,
  offer,
  onUndone,
}: {
  tenantSlug: string;
  offer: FillUndoOffer;
  onUndone: (result: FillUndoResult) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const range = formatFillRange(offer.start, offer.end);
  const visits = `${offer.visitCount} ${offer.visitCount === 1 ? 'visit' : 'visits'}`;

  async function undo() {
    setWorking(true);
    setError('');
    try {
      const result = await undoFillScheduleRun(tenantSlug, offer.runId);
      if (result.error) {
        setError(result.error);
        setWorking(false);
        return;
      }
      onUndone(result);
    } catch {
      setError('The undo did not finish.');
      setWorking(false);
    }
  }

  if (!confirming) {
    return (
      <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
        Undo this run
      </Button>
    );
  }

  return (
    <div className={styles.undoConfirm} role="group" aria-label="Undo this scheduling run">
      <p>
        Take {visits} from {range} off the calendar? Crew from this run is removed with them. A
        visit someone already started stays put.
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
      <div className={styles.resultActions}>
        <Button type="button" variant="danger" onClick={() => void undo()} loading={working}>
          Remove these visits
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirming(false)}
          disabled={working}
        >
          Keep them
        </Button>
      </div>
    </div>
  );
}

export function FillUndoKeptList({ kept }: { kept: FillUndoResult['kept'] }) {
  if (kept.length === 0) return null;
  return (
    <div className={styles.notes}>
      <h3>Stayed on the calendar</h3>
      <ul>
        {kept.map((visit) => (
          <li key={visit.visitId}>
            <Link href={`/schedule/${visit.visitId}`}>
              {visit.customerName}, {visit.title}
            </Link>
            . {visit.reason}
          </li>
        ))}
      </ul>
    </div>
  );
}
