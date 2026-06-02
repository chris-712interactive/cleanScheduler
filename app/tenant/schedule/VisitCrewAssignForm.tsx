'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { ScheduleOverlapConfirm } from '@/components/schedule/ScheduleOverlapConfirm';
import { useServerActionVisitPatch } from '@/lib/hooks/useServerActionVisitPatch';
import type { VisitDetailPatch } from '@/lib/tenant/visitDetailPatch';
import { updateScheduledVisitAssignees, type ScheduleFormState } from './actions';
import type { EmployeeOption } from './ScheduleVisitForm';
import styles from './schedule.module.scss';

const initial: ScheduleFormState = {};

type CrewAvailabilityRow = {
  userId: string;
  name: string;
  available: boolean;
  reasons: string[];
};

export function VisitCrewAssignForm({
  tenantSlug,
  visitId,
  startsAtIso,
  endsAtIso,
  currentAssigneeUserIds,
  employeeOptions,
  onVisitPatch,
}: {
  tenantSlug: string;
  visitId: string;
  startsAtIso: string;
  endsAtIso: string;
  currentAssigneeUserIds: string[];
  employeeOptions: EmployeeOption[];
  onVisitPatch?: (patch: VisitDetailPatch) => void;
}) {
  const [state, formAction, pending] = useActionState(updateScheduledVisitAssignees, initial);
  useServerActionVisitPatch(state.success, state.visitPatch, onVisitPatch);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(currentAssigneeUserIds),
  );
  const [crewFilter, setCrewFilter] = useState('');
  const [crewAvailability, setCrewAvailability] = useState<CrewAvailabilityRow[]>([]);
  const [confirmUnavailable, setConfirmUnavailable] = useState(false);
  const [overlapConfirm, setOverlapConfirm] = useState(false);

  useEffect(() => {
    setSelectedIds(new Set(currentAssigneeUserIds));
  }, [currentAssigneeUserIds]);

  useEffect(() => {
    setConfirmUnavailable(false);
    setOverlapConfirm(false);
  }, [state.error, state.success, state.needsOverlapConfirm, selectedIds]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const params = new URLSearchParams({
          starts_at: startsAtIso,
          ends_at: endsAtIso,
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
  }, [startsAtIso, endsAtIso]);

  const availabilityByUser = useMemo(
    () => new Map(crewAvailability.map((row) => [row.userId, row])),
    [crewAvailability],
  );

  const filteredCrew = useMemo(() => {
    const q = crewFilter.trim().toLowerCase();
    if (!q) return employeeOptions;
    return employeeOptions.filter((e) => e.label.toLowerCase().includes(q));
  }, [crewFilter, employeeOptions]);

  const conflicts = state.conflicts ?? [];
  const hasConflicts = conflicts.length > 0;
  const saveBlocked = hasConflicts && !overlapConfirm;

  const toggleAssignee = (userId: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  };

  return (
    <form action={formAction} className={styles.visitRescheduleCard}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="visit_id" value={visitId} />
      {confirmUnavailable ? <input type="hidden" name="confirm_unavailable" value="true" /> : null}

      <p className={styles.visitRescheduleTitle}>Assign crew</p>
      <p className={styles.visitRescheduleHint}>
        Choose who is scheduled for this visit. Availability reflects the current appointment time.
      </p>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.needsOverlapConfirm && !confirmUnavailable && conflicts.length === 0 ? (
        <div className={styles.confirmBox} role="status">
          <p>Some selected crew are unavailable at this time.</p>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={() => setConfirmUnavailable(true)}
          >
            Assign anyway
          </button>
        </div>
      ) : null}
      {state.success ? (
        <p className={styles.success} role="status">
          Crew assignment saved.
        </p>
      ) : null}

      <ScheduleOverlapConfirm
        conflicts={conflicts}
        showConfirmField={hasConflicts}
        confirmChecked={overlapConfirm}
        onConfirmChange={setOverlapConfirm}
      />

      <fieldset className={styles.crewFieldset}>
        <legend className={styles.crewLegend}>Crew</legend>
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
                    ) : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <div className={styles.visitRescheduleActions}>
        <button type="submit" className={styles.submit} disabled={pending || saveBlocked}>
          {pending ? 'Saving…' : 'Save crew'}
        </button>
      </div>
    </form>
  );
}
