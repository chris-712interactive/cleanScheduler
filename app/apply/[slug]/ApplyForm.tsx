'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  HIRING_CONSENT_COPY,
  HIRING_GATE_LABELS,
  type HiringGateKey,
} from '@/lib/hiring/questions';
import { submitApplicationAction, type ApplyActionState } from './actions';
import styles from '../apply.module.scss';

const initial: ApplyActionState = {};

export function ApplyForm({
  tenantSlug,
  openingSlug,
  gates,
}: {
  tenantSlug: string;
  openingSlug: string;
  gates: HiringGateKey[];
}) {
  const [state, formAction, pending] = useActionState(submitApplicationAction, initial);
  const [startedAt, setStartedAt] = useState('');
  useEffect(() => {
    setStartedAt(String(Date.now()));
  }, []);

  if (state.success) {
    return <p className={styles.success}>{state.success}</p>;
  }

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="opening_slug" value={openingSlug} />
      <input type="hidden" name="started_at" value={startedAt} />
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Company website
          <input name="company_website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className={styles.field}>
        <span>Name</span>
        <input name="full_name" required autoComplete="name" />
      </label>
      <label className={styles.field}>
        <span>Email</span>
        <input name="email" type="email" required autoComplete="email" />
      </label>
      <label className={styles.field}>
        <span>Mobile phone</span>
        <input name="phone" type="tel" required autoComplete="tel" />
      </label>
      {gates.map((gate) => (
        <fieldset key={gate} className={styles.question}>
          <legend>{HIRING_GATE_LABELS[gate]}</legend>
          <label>
            <input type="radio" name={gate} value="yes" required /> Yes
          </label>
          <label>
            <input type="radio" name={gate} value="no" required /> No
          </label>
        </fieldset>
      ))}
      <label className={styles.field}>
        <span>Anything we should know? Optional.</span>
        <textarea name="note" rows={3} maxLength={1000} />
      </label>
      <label className={styles.consent}>
        <input type="checkbox" name="consent" value="true" required />
        <span>{HIRING_CONSENT_COPY}</span>
      </label>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      <Button type="submit" disabled={pending || !startedAt}>
        {pending ? 'Sending…' : 'Submit application'}
      </Button>
    </form>
  );
}
