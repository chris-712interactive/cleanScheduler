'use client';

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import styles from './schedule.module.scss';

export function RecurringScopeForm({
  seriesVisit,
  action,
  className,
  children,
}: {
  seriesVisit: boolean;
  action: (payload: FormData) => void;
  className?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (!seriesVisit) return;
    const scope = new FormData(event.currentTarget).get('edit_scope');
    if (scope === 'occurrence' || scope === 'future') return;
    event.preventDefault();
    setOpen(true);
  };

  const choose = (scope: 'occurrence' | 'future') => {
    const form = formRef.current;
    const input = form?.querySelector<HTMLInputElement>('input[name="edit_scope"]');
    if (input) input.value = scope;
    setOpen(false);
    form?.requestSubmit();
  };

  return (
    <form ref={formRef} action={action} className={className} onSubmit={onSubmit}>
      <input type="hidden" name="edit_scope" defaultValue="" />
      {children}
      <RecurringEditScopeDialog open={open} onChoose={choose} onClose={() => setOpen(false)} />
    </form>
  );
}

export function RecurringEditScopeDialog({
  open,
  onChoose,
  onClose,
}: {
  open: boolean;
  onChoose: (scope: 'occurrence' | 'future') => void;
  onClose: () => void;
}) {
  const titleId = useId();
  const firstButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    firstButton.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div className={styles.scopeBackdrop}>
      <div className={styles.scopeDialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId} className={styles.scopeTitle}>
          Edit repeating visit
        </h2>
        <p className={styles.scopeCopy}>
          Apply this change to this visit only, or to this visit and every visit after it.
        </p>
        <div className={styles.scopeActions}>
          <button
            ref={firstButton}
            type="button"
            className={styles.scopeChoice}
            onClick={() => onChoose('occurrence')}
          >
            This visit only
          </button>
          <button type="button" className={styles.scopeChoice} onClick={() => onChoose('future')}>
            This and future visits
          </button>
        </div>
        <p className={styles.scopeNote}>
          Completed visits stay as they are. A future visit you already moved keeps its time. Past
          invoices are left alone.
        </p>
        <button type="button" className={styles.scopeCancel} onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  );
}
