'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { SearchableSelect } from '@/components/ui/SearchableSelect';
import { shiftEndFromStartAndDuration } from '@/lib/datetime/shiftVisitEndFromStart';
import {
  CONSULTATION_VISIT_TITLE,
  formatConsultationDurationLabel,
} from '@/lib/tenant/consultationDuration';
import { createScheduledVisit, type ScheduleFormState } from './actions';
import type { QuoteCustomerOption } from '@/app/tenant/quotes/QuoteCreateForm';
import type { CustomerPropertyGroup } from '@/app/tenant/quotes/QuoteCreateForm';
import { OFFICE_SET_PRICE_HINT } from '@/lib/billing/resolveVisitExpectedAmount';
import styles from './schedule.module.scss';

const initial: ScheduleFormState = {};

type CrewAvailabilityRow = {
  userId: string;
  name: string;
  available: boolean;
  reasons: string[];
};

export type EmployeeOption = { id: string; label: string };

export function ScheduleVisitForm({
  tenantSlug,
  tenantTimezone,
  customerOptions,
  customerPropertyGroups,
  quoteOptions,
  employeeOptions,
  defaults,
  isConsultation = false,
  consultationDurationMinutes = 60,
  returnTo = null,
}: {
  tenantSlug: string;
  tenantTimezone: string;
  customerOptions: QuoteCustomerOption[];
  customerPropertyGroups: CustomerPropertyGroup[];
  quoteOptions: { id: string; label: string }[];
  employeeOptions: EmployeeOption[];
  defaults?: {
    customerId?: string;
    propertyId?: string;
    quoteId?: string;
    title?: string;
    purpose?: 'service' | 'consultation';
  };
  isConsultation?: boolean;
  consultationDurationMinutes?: number;
  returnTo?: string | null;
}) {
  const [state, formAction, pending] = useActionState(createScheduledVisit, initial);

  const [customerId, setCustomerId] = useState(defaults?.customerId ?? '');
  const [crewFilter, setCrewFilter] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [crewAvailability, setCrewAvailability] = useState<CrewAvailabilityRow[]>([]);
  const [confirmUnavailable, setConfirmUnavailable] = useState(false);

  const propertyOptions = useMemo(() => {
    return customerPropertyGroups.find((g) => g.customerId === customerId)?.options ?? [];
  }, [customerPropertyGroups, customerId]);

  const singlePropertyId =
    isConsultation && propertyOptions.length === 1 ? propertyOptions[0]?.id : null;

  useEffect(() => {
    if (!isConsultation || !startsAt) return;
    const shifted = shiftEndFromStartAndDuration(
      startsAt,
      consultationDurationMinutes / 60,
      tenantTimezone,
    );
    if (shifted) setEndsAt(shifted);
  }, [consultationDurationMinutes, isConsultation, startsAt, tenantTimezone]);

  useEffect(() => {
    if (!startsAt || !endsAt) {
      setCrewAvailability([]);
      return;
    }

    const startMs = new Date(startsAt).getTime();
    const endMs = new Date(endsAt).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
      setCrewAvailability([]);
      return;
    }

    const controller = new AbortController();
    const load = async () => {
      try {
        const params = new URLSearchParams({
          starts_at: new Date(startsAt).toISOString(),
          ends_at: new Date(endsAt).toISOString(),
        });
        const res = await fetch(`/api/tenant/schedule/crew-availability?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const json = (await res.json()) as { crew?: CrewAvailabilityRow[] };
        setCrewAvailability(json.crew ?? []);
      } catch {
        /* ignore abort / network */
      }
    };

    void load();
    return () => controller.abort();
  }, [startsAt, endsAt]);

  const availabilityByUser = useMemo(
    () => new Map(crewAvailability.map((row) => [row.userId, row])),
    [crewAvailability],
  );

  const filteredCrew = useMemo(() => {
    const q = crewFilter.trim().toLowerCase();
    if (!q) return employeeOptions;
    return employeeOptions.filter((e) => e.label.toLowerCase().includes(q));
  }, [employeeOptions, crewFilter]);

  const consultationDurationLabel = formatConsultationDurationLabel(consultationDurationMinutes);

  return (
    <form action={formAction} className={styles.formCompact}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input
        type="hidden"
        name="visit_purpose"
        value={isConsultation ? 'consultation' : 'service'}
      />
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
      <input
        type="hidden"
        name="client_timezone_offset"
        value={String(new Date().getTimezoneOffset())}
      />
      {isConsultation ? (
        <>
          <input type="hidden" name="title" value={CONSULTATION_VISIT_TITLE} />
          <input type="hidden" name="status" value="scheduled" />
          {singlePropertyId ? (
            <input type="hidden" name="property_id" value={singlePropertyId} />
          ) : null}
        </>
      ) : null}
      {confirmUnavailable ? (
        <input type="hidden" name="confirm_unavailable" value="true" readOnly />
      ) : null}
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.needsOverlapConfirm && !confirmUnavailable ? (
        <div className={styles.confirmBox} role="status">
          <p>Some selected crew are unavailable at this time.</p>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={() => setConfirmUnavailable(true)}
          >
            Schedule anyway
          </button>
        </div>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          {isConsultation ? 'Consultation scheduled.' : 'Visit scheduled.'}
        </p>
      ) : null}

      {isConsultation ? (
        <div className={styles.consultationStaticCard} role="status">
          <p className={styles.consultationStaticLabel}>Visit type</p>
          <p className={styles.consultationStaticValue}>
            Consultation · {consultationDurationLabel}
          </p>
          <p className={styles.crewHint}>
            Consultations are separate from cleaning visits and are never linked to a quote.
          </p>
        </div>
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

      {isConsultation ? (
        propertyOptions.length > 1 ? (
          <div className={styles.formGridFull}>
            <div className={styles.formField}>
              <label className={styles.label} htmlFor="visit_property">
                Location
              </label>
              <select
                key={`sch_prop_${customerId || 'none'}`}
                id="visit_property"
                name="property_id"
                className={styles.select}
                defaultValue={defaults?.propertyId ?? ''}
                disabled={!customerId}
                required
              >
                <option value="" disabled>
                  Select a location
                </option>
                {propertyOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null
      ) : (
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
              defaultValue={defaults?.propertyId ?? ''}
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
            <select
              id="visit_quote"
              name="quote_id"
              className={styles.select}
              defaultValue={defaults?.quoteId ?? ''}
            >
              <option value="">— None —</option>
              {quoteOptions.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {isConsultation ? null : (
        <>
          <div className={styles.formGridTwo}>
            <div className={styles.formField}>
              <label className={styles.label} htmlFor="visit_job_price">
                Job price (USD)
              </label>
              <input
                id="visit_job_price"
                name="job_price_dollars"
                className={styles.input}
                type="number"
                min="0"
                step="0.01"
                placeholder="150.00"
              />
              <p className={styles.crewHint}>{OFFICE_SET_PRICE_HINT}</p>
            </div>
            <div className={styles.formField} aria-hidden />
          </div>

          <div className={styles.formGridTwo}>
            <div className={styles.formField}>
              <label className={styles.label} htmlFor="visit_title">
                Title
              </label>
              <input
                id="visit_title"
                name="title"
                className={styles.input}
                defaultValue={defaults?.title?.trim() || 'Visit'}
              />
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
        </>
      )}

      {isConsultation ? (
        <div className={styles.formGridFull}>
          <div className={styles.formField}>
            <label className={styles.label} htmlFor="visit_starts">
              Start date & time
            </label>
            <input
              id="visit_starts"
              name="starts_at"
              className={styles.input}
              type="datetime-local"
              required
              value={startsAt}
              onChange={(e) => {
                setConfirmUnavailable(false);
                setStartsAt(e.target.value);
              }}
            />
          </div>
          <input type="hidden" name="ends_at" value={endsAt} />
          <p className={styles.crewHint}>
            Ends automatically {consultationDurationLabel} after start
            {endsAt ? ` (${new Date(endsAt).toLocaleString()})` : ''}.
          </p>
        </div>
      ) : (
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
              value={startsAt}
              onChange={(e) => {
                setConfirmUnavailable(false);
                setStartsAt(e.target.value);
              }}
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
              value={endsAt}
              onChange={(e) => {
                setConfirmUnavailable(false);
                setEndsAt(e.target.value);
              }}
            />
          </div>
        </div>
      )}

      <div className={styles.formGridFull}>
        <fieldset className={styles.crewFieldset}>
          <legend className={styles.crewLegend}>
            {isConsultation ? 'Consultant' : 'Crew (optional)'}
          </legend>
          <p className={styles.crewHint}>
            {isConsultation
              ? 'Choose who will run this consultation.'
              : 'Choose who is scheduled to work this visit.'}
          </p>
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
              {filteredCrew.map((e) => {
                const availability = availabilityByUser.get(e.id);
                return (
                  <li key={e.id} className={styles.crewItem}>
                    <label className={styles.crewLabel}>
                      <input
                        type="checkbox"
                        name="assignee_user_id"
                        value={e.id}
                        className={styles.crewCheck}
                      />
                      <span>{e.label}</span>
                      {availability ? (
                        <span
                          className={
                            availability.available ? styles.crewAvailable : styles.crewUnavailable
                          }
                        >
                          {availability.available
                            ? 'Available'
                            : availability.reasons.join(' · ') || 'Unavailable'}
                        </span>
                      ) : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </fieldset>
      </div>

      {isConsultation ? null : (
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
      )}

      <div className={styles.formActions}>
        <button
          type="submit"
          className={styles.submit}
          disabled={pending || (isConsultation && !endsAt)}
        >
          {pending ? 'Saving…' : isConsultation ? 'Schedule consultation' : 'Add visit'}
        </button>
      </div>
    </form>
  );
}
