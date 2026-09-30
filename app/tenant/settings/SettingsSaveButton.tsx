'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './settings.module.scss';

export function SettingsSaveButton({
  pending,
  saved = false,
  idleLabel = 'Save changes',
  pendingLabel = 'Saving…',
  savedLabel = 'Saved',
  className,
}: {
  pending: boolean;
  saved?: boolean;
  idleLabel?: string;
  pendingLabel?: string;
  savedLabel?: string;
  className?: string;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const wasPending = useRef(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (wasPending.current && !pending && saved) setLocked(true);
    if (!saved) setLocked(false);
    wasPending.current = pending;
  }, [pending, saved]);

  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!form) return;
    const unlock = () => setLocked(false);
    form.addEventListener('input', unlock);
    form.addEventListener('change', unlock);
    return () => {
      form.removeEventListener('input', unlock);
      form.removeEventListener('change', unlock);
    };
  }, []);

  const showSaved = locked && !pending;

  return (
    <button
      ref={buttonRef}
      type="submit"
      className={[styles.saveButton, className].filter(Boolean).join(' ')}
      disabled={pending || showSaved}
      data-saving={pending || undefined}
      data-saved={showSaved || undefined}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel : showSaved ? savedLabel : idleLabel}
    </button>
  );
}
