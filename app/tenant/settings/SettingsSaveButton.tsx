'use client';

import styles from './settings.module.scss';

export function SettingsSaveButton({
  pending,
  idleLabel = 'Save changes',
  pendingLabel = 'Saving…',
  className,
}: {
  pending: boolean;
  idleLabel?: string;
  pendingLabel?: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={[styles.saveButton, className].filter(Boolean).join(' ')}
      disabled={pending}
      data-saving={pending || undefined}
      aria-busy={pending || undefined}
    >
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
