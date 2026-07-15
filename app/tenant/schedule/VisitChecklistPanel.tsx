'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import {
  toggleVisitChecklistItemAction,
  type VisitChecklistActionState,
} from './visitChecklistActions';
import type { VisitChecklistItem } from '@/lib/visits/visitChecklist';
import { checklistProgress } from '@/lib/visits/visitChecklist';
import styles from './visitDetail.module.scss';

const initial: VisitChecklistActionState = {};

export function VisitChecklistPanel({
  tenantSlug,
  visitId,
  items: initialItems,
  readOnly = false,
}: {
  tenantSlug: string;
  visitId: string;
  items: VisitChecklistItem[];
  readOnly?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [, startTransition] = useTransition();
  const [state, formAction, pending] = useActionState(toggleVisitChecklistItemAction, initial);
  const progress = checklistProgress(items);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (state.items) setItems(state.items);
  }, [state.items]);

  if (items.length === 0) return null;

  return (
    <section className={styles.checklistPanel} aria-labelledby="visit-checklist-heading">
      <div className={styles.checklistHeader}>
        <h3 id="visit-checklist-heading" className={styles.checklistTitle}>
          Visit checklist
        </h3>
        <span className={styles.checklistProgress}>{progress.label} done</span>
      </div>
      {state.error ? (
        <p className={styles.fieldError} role="alert">
          {state.error}
        </p>
      ) : null}
      <ul className={styles.checklistList}>
        {items.map((item) => (
          <li key={item.id}>
            <label className={styles.checklistItem}>
              <input
                type="checkbox"
                checked={item.done}
                disabled={readOnly || pending}
                onChange={(event) => {
                  const done = event.target.checked;
                  setItems((current) =>
                    current.map((row) =>
                      row.id === item.id
                        ? { ...row, done, done_at: done ? new Date().toISOString() : null }
                        : row,
                    ),
                  );
                  startTransition(() => {
                    const fd = new FormData();
                    fd.set('tenant_slug', tenantSlug);
                    fd.set('visit_id', visitId);
                    fd.set('item_id', item.id);
                    fd.set('done', done ? 'true' : 'false');
                    formAction(fd);
                  });
                }}
              />
              <span className={item.done ? styles.checklistLabelDone : undefined}>
                {item.label}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
