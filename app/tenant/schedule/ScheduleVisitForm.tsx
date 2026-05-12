'use client';

import { useActionState, useMemo, useState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { createScheduledVisit, type ScheduleFormState } from './actions';
import type { QuoteCustomerOption } from '@/app/tenant/quotes/QuoteCreateForm';
import type { CustomerPropertyGroup } from '@/app/tenant/quotes/QuoteCreateForm';
import styles from './schedule.module.scss';

const initial: ScheduleFormState = {};

export function ScheduleVisitForm({
  tenantSlug,
  customerOptions,
  customerPropertyGroups,
  quoteOptions,
}: {
  tenantSlug: string;
  customerOptions: QuoteCustomerOption[];
  customerPropertyGroups: CustomerPropertyGroup[];
  quoteOptions: { id: string; label: string }[];
}) {
  const [state, formAction, pending] = useActionState(createScheduledVisit, initial);
  useRefreshOnServerActionSuccess(state.success);

  const [customerId, setCustomerId] = useState('');

  const propertyOptions = useMemo(() => {
    return customerPropertyGroups.find((g) => g.customerId === customerId)?.options ?? [];
  }, [customerPropertyGroups, customerId]);

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Visit scheduled.
        </p>
      ) : null}

      <label className={styles.label} htmlFor="visit_customer">
        Customer
      </label>
      <select
        id="visit_customer"
        name="customer_id"
        className={styles.select}
        required
        value={customerId}
        onChange={(e) => setCustomerId(e.target.value)}
      >
        <option value="">— Select —</option>
        {customerOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      <label className={styles.label} htmlFor="visit_property">
        Service location (optional)
      </label>
      <select
        key={`sch_prop_${customerId || 'none'}`}
        id="visit_property"
        name="property_id"
        className={styles.select}
        defaultValue=""
        disabled={!customerId || propertyOptions.length === 0}
      >
        <option value="">— Any / TBD —</option>
        {propertyOptions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      <label className={styles.label} htmlFor="visit_quote">
        Related quote (optional)
      </label>
      <select id="visit_quote" name="quote_id" className={styles.select} defaultValue="">
        <option value="">— None —</option>
        {quoteOptions.map((q) => (
          <option key={q.id} value={q.id}>
            {q.label}
          </option>
        ))}
      </select>

      <label className={styles.label} htmlFor="visit_title">
        Title
      </label>
      <input id="visit_title" name="title" className={styles.input} defaultValue="Visit" />

      <label className={styles.label} htmlFor="visit_starts">
        Starts
      </label>
      <input id="visit_starts" name="starts_at" className={styles.input} type="datetime-local" required />

      <label className={styles.label} htmlFor="visit_ends">
        Ends
      </label>
      <input id="visit_ends" name="ends_at" className={styles.input} type="datetime-local" required />

      <label className={styles.label} htmlFor="visit_status">
        Status
      </label>
      <select id="visit_status" name="status" className={styles.select} defaultValue="scheduled">
        <option value="scheduled">Scheduled</option>
        <option value="completed">Completed</option>
        <option value="cancelled">Cancelled</option>
      </select>

      <label className={styles.label} htmlFor="visit_notes">
        Notes
      </label>
      <textarea id="visit_notes" name="notes" className={styles.textarea} placeholder="Crew notes, supplies…" />

      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Saving…' : 'Add visit'}
      </button>
    </form>
  );
}
