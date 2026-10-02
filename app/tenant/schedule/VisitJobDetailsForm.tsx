'use client';

import { useActionState, useState } from 'react';
import { useServerActionVisitPatch } from '@/lib/hooks/useServerActionVisitPatch';
import type { VisitDetailPatch } from '@/lib/tenant/visitDetailPatch';
import { updateVisitJobDetails, type ScheduleFormState } from './actions';
import styles from './schedule.module.scss';

const initial: ScheduleFormState = {};

export function VisitJobDetailsForm({
  tenantSlug,
  visitId,
  title,
  notes,
  jobTypeLabels,
  isConsultation,
  onVisitPatch,
}: {
  tenantSlug: string;
  visitId: string;
  title: string;
  notes: string;
  jobTypeLabels: string[];
  isConsultation: boolean;
  onVisitPatch?: (patch: VisitDetailPatch) => void;
}) {
  const [state, formAction, pending] = useActionState(updateVisitJobDetails, initial);
  useServerActionVisitPatch(state.success, state.visitPatch, onVisitPatch);
  const [jobTitle, setJobTitle] = useState(title);
  const matchedType = jobTypeLabels.includes(jobTitle) ? jobTitle : '';

  return (
    <form action={formAction} className={styles.formCompact}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="visit_id" value={visitId} />
      <p className={styles.crewHint}>
        Field employees see the job title and these notes when they open the job.
      </p>
      {isConsultation ? (
        <input type="hidden" name="title" value={title} />
      ) : (
        <>
          {jobTypeLabels.length > 0 ? (
            <div className={styles.formField}>
              <label className={styles.label} htmlFor="visit_job_type_edit">
                Job type
              </label>
              <select
                id="visit_job_type_edit"
                className={styles.select}
                value={matchedType}
                onChange={(event) => {
                  const next = event.target.value;
                  if (next) setJobTitle(next);
                }}
              >
                <option value="">Custom title</option>
                {jobTypeLabels.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className={styles.formField}>
            <label className={styles.label} htmlFor="visit_title_edit">
              Job title
            </label>
            <input
              id="visit_title_edit"
              name="title"
              className={styles.input}
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              maxLength={160}
            />
          </div>
        </>
      )}
      <div className={styles.formField}>
        <label className={styles.label} htmlFor="visit_job_notes_edit">
          Job notes
        </label>
        <textarea
          id="visit_job_notes_edit"
          name="notes"
          className={styles.textarea}
          rows={4}
          defaultValue={notes}
          placeholder="Supplies, special requests, what the crew should know for this visit"
        />
      </div>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Job details saved.
        </p>
      ) : null}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? 'Saving…' : 'Save job details'}
      </button>
    </form>
  );
}
