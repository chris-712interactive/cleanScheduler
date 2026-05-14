'use client';

import { useActionState, useMemo, useState } from 'react';
import { useRefreshOnServerActionSuccess } from '@/lib/hooks/useRefreshOnServerActionSuccess';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { createScheduledVisit, type ScheduleFormState } from './actions';
import type { QuoteCustomerOption } from '@/app/tenant/quotes/QuoteCreateForm';
import type { CustomerPropertyGroup } from '@/app/tenant/quotes/QuoteCreateForm';
import styles from './schedule.module.scss';

const initial: ScheduleFormState = {};

export type EmployeeOption = { id: string; label: string };

export function ScheduleVisitForm({
  tenantSlug,
  customerOptions,
  customerPropertyGroups,
  quoteOptions,
  employeeOptions,
}: {
  tenantSlug: string;
  customerOptions: QuoteCustomerOption[];
  customerPropertyGroups: CustomerPropertyGroup[];
  quoteOptions: { id: string; label: string }[];
  employeeOptions: EmployeeOption[];
}) {
  const [state, formAction, pending] = useActionState(createScheduledVisit, initial);
  useRefreshOnServerActionSuccess(state.success);

  const [customerId, setCustomerId] = useState('');
  const [crewFilter, setCrewFilter] = useState('');

  const propertyOptions = useMemo(() => {
    return customerPropertyGroups.find((g) => g.customerId === customerId)?.options ?? [];
  }, [customerPropertyGroups, customerId]);

  const filteredCrew = useMemo(() => {
    const q = crewFilter.trim().toLowerCase();
    if (!q) return employeeOptions;
    return employeeOptions.filter((e) => e.label.toLowerCase().includes(q));
  }, [employeeOptions, crewFilter]);

  return (
    <form action={formAction} className={styles.formCompact}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input
        type="hidden"
        name="client_timezone_offset"
        value={String(new Date().getTimezoneOffset())}
      />
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

      <div className={styles.formGridFull}>
        <SearchableSelect
          id="visit_customer_search"
          name="customer_id"
          label="Customer"
          options={customerOptions.map((c) => ({ value: c.id, label: c.label }))}
          value={customerId}
          onValueChange={setCustomerId}
          placeholder="Search by name…"
          emptyText="No customers match"
        />
      </div>

      <div className={styles.formGridTwo}>
        <div className={styles.formField}>
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
        </div>
        <div className={styles.formField}>
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
        </div>
      </div>

      <div className={styles.formGridTwo}>
        <div className={styles.formField}>
          <label className={styles.label} htmlFor="visit_title">
            Title
          </label>
          <input id="visit_title" name="title" className={styles.input} defaultValue="Visit" />
        </div>
        <div className={styles.formField}>
          <label className={styles.label} htmlFor="visit_status">
            Status
          </label>
          <select
            id="visit_status"
            name="status"
            className={styles.select}
            defaultValue="scheduled"
          >
            <option value="scheduled">Scheduled</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      <div className={styles.formGridTwo}>
        <div className={styles.formField}>
          <label className={styles.label} htmlFor="visit_starts">
            Starts
          </label>
          <input
            id="visit_starts"
            name="starts_at"
            className={styles.input}
            type="datetime-local"
            required
          />
        </div>
        <div className={styles.formField}>
          <label className={styles.label} htmlFor="visit_ends">
            Ends
          </label>
          <input
            id="visit_ends"
            name="ends_at"
            className={styles.input}
            type="datetime-local"
            required
          />
        </div>
      </div>

      <div className={styles.formGridFull}>
        <fieldset className={styles.crewFieldset}>
          <legend className={styles.crewLegend}>Crew (optional)</legend>
          <p className={styles.crewHint}>Choose who is scheduled to work this visit.</p>
          <input
            className={styles.crewSearch}
            type="search"
            placeholder="Filter team…"
            value={crewFilter}
            onChange={(e) => setCrewFilter(e.target.value)}
            aria-label="Filter crew list"
          />
          {employeeOptions.length === 0 ? (
            <p className={styles.crewEmpty}>
              No active workspace members yet. Add people under Employees.
            </p>
          ) : (
            <ul className={styles.crewList}>
              {filteredCrew.map((e) => (
                <li key={e.id} className={styles.crewItem}>
                  <label className={styles.crewLabel}>
                    <input
                      type="checkbox"
                      name="assignee_user_id"
                      value={e.id}
                      className={styles.crewCheck}
                    />
                    <span>{e.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
      </div>

      <div className={styles.formGridFull}>
        <label className={styles.label} htmlFor="visit_notes">
          Notes
        </label>
        <textarea
          id="visit_notes"
          name="notes"
          className={styles.textarea}
          placeholder="Crew notes, supplies…"
        />
      </div>

      <div className={styles.formActions}>
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? 'Saving…' : 'Add visit'}
        </button>
      </div>
    </form>
  );
}
