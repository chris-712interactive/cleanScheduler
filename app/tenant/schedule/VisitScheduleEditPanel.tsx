'use client';

import { useActionState, useCallback, useEffect, useMemo, useState } from 'react';
import { Users } from 'lucide-react';
import { ScheduleOverlapConfirm } from '@/components/schedule/ScheduleOverlapConfirm';
import { isoToLocalDatetimeLocalValue } from '@/lib/datetime/isoToLocalDatetimeLocalValue';
import { parseTenantDatetimeLocalToIso } from '@/lib/datetime/parseTenantDatetimeLocal';
import { shiftEndFromStartAndDuration } from '@/lib/datetime/shiftVisitEndFromStart';
import { useServerActionVisitPatch } from '@/lib/hooks/useServerActionVisitPatch';
import type {
  VisitSchedulingPreview,
  VisitTimeSuggestion,
} from '@/lib/schedule/visitSchedulingPreview';
import type { VisitDetailPatch } from '@/lib/tenant/visitDetailPatch';
import {
  updateScheduledVisitAssignees,
  updateScheduledVisitTimes,
  type ScheduleFormState,
} from './actions';
import type { EmployeeOption } from './ScheduleVisitForm';
import styles from './schedule.module.scss';

const initial: ScheduleFormState = {};

type PreviewState = {
  loading: boolean;
  data: VisitSchedulingPreview | null;
};

function useSchedulingPreview(params: {
  visitId: string;
  startsLocal: string;
  endsLocal: string;
  selectedAssigneeIds: string[];
  tenantTimezone: string;
}) {
  const [preview, setPreview] = useState<PreviewState>({ loading: false, data: null });

  useEffect(() => {
    const startsIso = parseTenantDatetimeLocalToIso(params.startsLocal, params.tenantTimezone);
    const endsIso = parseTenantDatetimeLocalToIso(params.endsLocal, params.tenantTimezone);
    if (!startsIso || !endsIso || new Date(endsIso) <= new Date(startsIso)) {
      setPreview({ loading: false, data: null });
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreview((current) => ({ ...current, loading: true }));
      try {
        const query = new URLSearchParams({
          visit_id: params.visitId,
          starts_at: startsIso,
          ends_at: endsIso,
        });
        for (const id of params.selectedAssigneeIds) {
          query.append('assignee_user_id', id);
        }
        const res = await fetch(`/api/tenant/schedule/visit-scheduling-preview?${query}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setPreview({ loading: false, data: null });
          return;
        }
        const data = (await res.json()) as VisitSchedulingPreview;
        setPreview({ loading: false, data });
      } catch {
        if (!controller.signal.aborted) {
          setPreview({ loading: false, data: null });
        }
      }
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    params.visitId,
    params.startsLocal,
    params.endsLocal,
    params.selectedAssigneeIds,
    params.tenantTimezone,
  ]);

  return preview;
}

function SuggestionList({
  suggestions,
  onApply,
}: {
  suggestions: VisitTimeSuggestion[];
  onApply: (suggestion: VisitTimeSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <div
      className={styles.scheduleSuggestions}
      role="region"
      aria-label="Suggested appointment times"
    >
      <p className={styles.scheduleSuggestionsTitle}>Suggested times</p>
      <p className={styles.scheduleSuggestionsHint}>
        These openings fit your expected job length and crew availability.
      </p>
      <ul className={styles.scheduleSuggestionsListHorizontal}>
        {suggestions.map((suggestion) => (
          <li key={suggestion.startsAt}>
            <button
              type="button"
              className={styles.scheduleSuggestionCard}
              onClick={() => onApply(suggestion)}
            >
              <span className={styles.scheduleSuggestionWhen}>{suggestion.whenLabel}</span>
              {suggestion.suggestedAssigneeName ? (
                <span className={styles.scheduleSuggestionMeta}>
                  Suggested crew · {suggestion.suggestedAssigneeName}
                </span>
              ) : suggestion.forCurrentCrew ? (
                <span className={styles.scheduleSuggestionMeta}>Works for assigned crew</span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VisitScheduleEditPanel({
  tenantSlug,
  tenantTimezone,
  visitId,
  startsAtIso,
  endsAtIso,
  durationHours,
  durationSourceLabel,
  currentAssigneeUserIds,
  employeeOptions,
  isConsultation = false,
  onVisitPatch,
}: {
  tenantSlug: string;
  tenantTimezone: string;
  visitId: string;
  startsAtIso: string;
  endsAtIso: string;
  durationHours: number;
  durationSourceLabel: string;
  currentAssigneeUserIds: string[];
  employeeOptions: EmployeeOption[];
  isConsultation?: boolean;
  onVisitPatch?: (patch: VisitDetailPatch) => void;
}) {
  const [timeState, timeAction, timePending] = useActionState(updateScheduledVisitTimes, initial);
  const [crewState, crewAction, crewPending] = useActionState(
    updateScheduledVisitAssignees,
    initial,
  );

  useServerActionVisitPatch(timeState.success, timeState.visitPatch, onVisitPatch);
  useServerActionVisitPatch(crewState.success, crewState.visitPatch, onVisitPatch);

  const [startsLocal, setStartsLocal] = useState('');
  const [endsLocal, setEndsLocal] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(currentAssigneeUserIds),
  );
  const [crewFilter, setCrewFilter] = useState('');
  const [timeOverlapConfirm, setTimeOverlapConfirm] = useState(false);
  const [timeConfirmUnavailable, setTimeConfirmUnavailable] = useState(false);
  const [crewOverlapConfirm, setCrewOverlapConfirm] = useState(false);
  const [crewConfirmUnavailable, setCrewConfirmUnavailable] = useState(false);
  const [endManuallyEdited, setEndManuallyEdited] = useState(false);

  useEffect(() => {
    setStartsLocal(isoToLocalDatetimeLocalValue(startsAtIso, tenantTimezone));
    setEndsLocal(isoToLocalDatetimeLocalValue(endsAtIso, tenantTimezone));
    setEndManuallyEdited(false);
  }, [startsAtIso, endsAtIso, tenantTimezone]);

  useEffect(() => {
    setSelectedIds(new Set(currentAssigneeUserIds));
  }, [currentAssigneeUserIds]);

  useEffect(() => {
    setTimeOverlapConfirm(false);
    setTimeConfirmUnavailable(false);
  }, [timeState.error, timeState.success, timeState.needsOverlapConfirm, startsLocal, endsLocal]);

  useEffect(() => {
    setCrewOverlapConfirm(false);
    setCrewConfirmUnavailable(false);
  }, [crewState.error, crewState.success, crewState.needsOverlapConfirm, selectedIds]);

  const selectedAssigneeIds = useMemo(() => [...selectedIds], [selectedIds]);
  const preview = useSchedulingPreview({
    visitId,
    startsLocal,
    endsLocal,
    selectedAssigneeIds,
    tenantTimezone,
  });

  const availabilityByUser = useMemo(() => {
    const map = new Map<string, { available: boolean; reasons: string[] }>();
    for (const row of preview.data?.crew ?? []) {
      map.set(row.userId, { available: row.available, reasons: row.reasons });
    }
    return map;
  }, [preview.data?.crew]);

  const filteredCrew = useMemo(() => {
    const q = crewFilter.trim().toLowerCase();
    if (!q) return employeeOptions;
    return employeeOptions.filter((e) => e.label.toLowerCase().includes(q));
  }, [crewFilter, employeeOptions]);

  const timeConflicts = timeState.conflicts ?? preview.data?.conflicts ?? [];
  const crewConflicts = crewState.conflicts ?? [];
  const timeHasConflicts = timeConflicts.length > 0;
  const crewHasConflicts = crewConflicts.length > 0;
  const timeSaveBlocked = timeHasConflicts && !timeOverlapConfirm;
  const crewSaveBlocked = crewHasConflicts && !crewOverlapConfirm;

  const showSuggestions =
    Boolean(preview.data?.hasSchedulingProblems) && (preview.data?.suggestions.length ?? 0) > 0;

  const handleStartChange = useCallback(
    (value: string) => {
      setStartsLocal(value);
      if (isConsultation || !endManuallyEdited) {
        const shifted = shiftEndFromStartAndDuration(value, durationHours, tenantTimezone);
        if (shifted) setEndsLocal(shifted);
      }
    },
    [durationHours, endManuallyEdited, isConsultation, tenantTimezone],
  );

  const applySuggestion = useCallback(
    (suggestion: VisitTimeSuggestion) => {
      setStartsLocal(isoToLocalDatetimeLocalValue(suggestion.startsAt, tenantTimezone));
      setEndsLocal(isoToLocalDatetimeLocalValue(suggestion.endsAt, tenantTimezone));
      setEndManuallyEdited(false);
      if (suggestion.suggestedAssigneeUserId) {
        setSelectedIds(new Set([suggestion.suggestedAssigneeUserId]));
      }
      setTimeOverlapConfirm(false);
      setTimeConfirmUnavailable(false);
      setCrewOverlapConfirm(false);
      setCrewConfirmUnavailable(false);
    },
    [tenantTimezone],
  );

  const toggleAssignee = (userId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  return (
    <div className={styles.visitScheduleEditPanel}>
      <div className={styles.visitScheduleEditHeader}>
        <div>
          <p className={styles.visitRescheduleTitle}>
            {isConsultation ? 'Consultation schedule' : 'Schedule'}
          </p>
          <p className={styles.visitRescheduleHint} title={durationSourceLabel}>
            {isConsultation
              ? `${durationSourceLabel} · end time auto-fills from start`
              : `${durationHours} hr job · end time auto-fills from start`}
          </p>
        </div>
      </div>

      {showSuggestions && !isConsultation ? (
        <SuggestionList suggestions={preview.data!.suggestions} onApply={applySuggestion} />
      ) : null}

      {preview.loading ? (
        <p className={styles.schedulePreviewLoading} role="status">
          Checking crew availability…
        </p>
      ) : null}

      {!preview.loading && preview.data?.hasSchedulingProblems && selectedAssigneeIds.length > 0 ? (
        <div className={styles.schedulePreviewAlert} role="status">
          <Users size={16} aria-hidden />
          <span>
            Selected crew are unavailable or conflicted — try a suggestion or adjust below.
          </span>
        </div>
      ) : null}

      <div className={styles.visitScheduleEditColumns}>
        <form action={timeAction} className={styles.visitScheduleSection}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="visit_id" value={visitId} />
          {timeConfirmUnavailable ? (
            <input type="hidden" name="confirm_unavailable" value="true" />
          ) : null}

          <h3 className={styles.visitScheduleSectionTitle}>Time</h3>

          {timeState.error ? (
            <p className={styles.error} role="alert">
              {timeState.error}
            </p>
          ) : null}
          {timeState.needsOverlapConfirm &&
          !timeConfirmUnavailable &&
          timeConflicts.length === 0 ? (
            <div className={styles.confirmBox} role="status">
              <p>Assigned crew are unavailable at this time.</p>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => setTimeConfirmUnavailable(true)}
              >
                Schedule anyway
              </button>
            </div>
          ) : null}
          {timeState.success ? (
            <p className={styles.success} role="status">
              Visit time saved.
            </p>
          ) : null}

          <ScheduleOverlapConfirm
            conflicts={timeConflicts}
            showConfirmField={timeHasConflicts}
            confirmChecked={timeOverlapConfirm}
            onConfirmChange={setTimeOverlapConfirm}
          />

          <div className={styles.visitRescheduleGrid}>
            <div className={styles.formField}>
              <label className={styles.label} htmlFor="visit_edit_starts_at">
                {isConsultation ? 'Start date & time' : 'Start'}
              </label>
              <input
                id="visit_edit_starts_at"
                name="starts_at"
                type="datetime-local"
                className={styles.input}
                value={startsLocal}
                onChange={(e) => handleStartChange(e.target.value)}
                required
              />
            </div>
            {isConsultation ? (
              <>
                <input type="hidden" name="ends_at" value={endsLocal} />
                <p className={styles.crewHint}>
                  Ends automatically based on your consultation length setting.
                </p>
              </>
            ) : (
              <div className={styles.formField}>
                <label className={styles.label} htmlFor="visit_edit_ends_at">
                  End
                </label>
                <input
                  id="visit_edit_ends_at"
                  name="ends_at"
                  type="datetime-local"
                  className={styles.input}
                  value={endsLocal}
                  onChange={(e) => {
                    setEndManuallyEdited(true);
                    setEndsLocal(e.target.value);
                  }}
                  required
                />
              </div>
            )}
          </div>

          <div className={styles.visitRescheduleActions}>
            <button
              type="submit"
              className={styles.submit}
              disabled={timePending || timeSaveBlocked}
            >
              {timePending ? 'Saving…' : 'Save time'}
            </button>
          </div>
        </form>

        <form action={crewAction} className={styles.visitScheduleSection}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="visit_id" value={visitId} />
          <input type="hidden" name="starts_at" value={startsLocal} />
          <input type="hidden" name="ends_at" value={endsLocal} />
          {crewConfirmUnavailable ? (
            <input type="hidden" name="confirm_unavailable" value="true" />
          ) : null}

          <h3 className={styles.visitScheduleSectionTitle}>
            {isConsultation ? 'Consultant' : 'Crew'}
          </h3>

          {crewState.error ? (
            <p className={styles.error} role="alert">
              {crewState.error}
            </p>
          ) : null}
          {crewState.needsOverlapConfirm &&
          !crewConfirmUnavailable &&
          crewConflicts.length === 0 ? (
            <div className={styles.confirmBox} role="status">
              <p>Some selected crew are unavailable at this time.</p>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => setCrewConfirmUnavailable(true)}
              >
                Assign anyway
              </button>
            </div>
          ) : null}
          {crewState.success ? (
            <p className={styles.success} role="status">
              Crew assignment saved.
            </p>
          ) : null}

          <ScheduleOverlapConfirm
            conflicts={crewConflicts}
            showConfirmField={crewHasConflicts}
            confirmChecked={crewOverlapConfirm}
            onConfirmChange={setCrewOverlapConfirm}
          />

          <fieldset className={`${styles.crewFieldset} ${styles.crewFieldsetCompact}`}>
            <legend className={styles.crewLegend}>{isConsultation ? 'Consultant' : 'Crew'}</legend>
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
              <ul className={`${styles.crewList} ${styles.crewListCompact}`}>
                {filteredCrew.map((e) => {
                  const availability = availabilityByUser.get(e.id);
                  const checked = selectedIds.has(e.id);
                  return (
                    <li key={e.id} className={styles.crewItem}>
                      <label className={styles.crewLabel}>
                        <input
                          type="checkbox"
                          name="assignee_user_id"
                          value={e.id}
                          className={styles.crewCheck}
                          checked={checked}
                          onChange={(ev) => toggleAssignee(e.id, ev.target.checked)}
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
                        ) : preview.loading ? (
                          <span className={styles.crewPending}>Checking…</span>
                        ) : null}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>

          <div className={styles.visitRescheduleActions}>
            <button
              type="submit"
              className={styles.submit}
              disabled={crewPending || crewSaveBlocked}
            >
              {crewPending ? 'Saving…' : 'Save crew'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
