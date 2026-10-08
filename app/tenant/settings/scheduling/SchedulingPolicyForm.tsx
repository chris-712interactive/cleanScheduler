'use client';

import { useActionState, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  factorIsForcedHard,
  SCHEDULE_FACTORS,
  SCHEDULE_FACTOR_CATEGORIES,
  type ScheduleFactorId,
} from '@/lib/schedule/optimizer/factors';
import { schedulePolicyPreset, type SchedulePolicyPresetId } from '@/lib/schedule/optimizer/policy';
import type { ScheduleOptimizerPolicy } from '@/lib/schedule/optimizer/types';
import { updateScheduleOptimizerPolicyAction, type SchedulingPolicyActionState } from './actions';
import styles from './scheduling-settings.module.scss';

const initial: SchedulingPolicyActionState = {};

const PRESETS: Array<{ id: SchedulePolicyPresetId; label: string }> = [
  { id: 'balanced', label: 'Balanced' },
  { id: 'residential_routes', label: 'Residential routes' },
  { id: 'commercial_sites', label: 'Commercial sites' },
  { id: 'even_workload', label: 'Even workload' },
];

export function SchedulingPolicyForm({
  tenantSlug,
  initialPolicy,
  readOnly = false,
}: {
  tenantSlug: string;
  initialPolicy: ScheduleOptimizerPolicy;
  readOnly?: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateScheduleOptimizerPolicyAction, initial);
  const [policy, setPolicy] = useState(initialPolicy);
  const [query, setQuery] = useState('');

  const visibleFactors = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SCHEDULE_FACTORS;
    return SCHEDULE_FACTORS.filter((factor) => {
      const haystack = `${factor.label} ${factor.description} ${factor.category}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [query]);

  const applyPreset = (id: SchedulePolicyPresetId) => {
    setPolicy(schedulePolicyPreset(id));
  };

  const patchFactor = (
    id: ScheduleFactorId,
    patch: Partial<ScheduleOptimizerPolicy['factors'][string]>,
  ) => {
    setPolicy((current) => {
      const existing = current.factors[id];
      if (!existing) return current;
      return {
        ...current,
        factors: {
          ...current.factors,
          [id]: { ...existing, ...patch },
        },
      };
    });
  };

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Starting point</h2>
        <p className={styles.sectionLead}>
          Presets change the weights on this page. Nothing is stored until you save. A factor with
          no data on a job is skipped, so a house-cleaning route still builds when skill tags are
          empty.
        </p>
        <div className={styles.presetRow}>
          {PRESETS.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="secondary"
              size="sm"
              disabled={readOnly || pending}
              onClick={() => applyPreset(preset.id)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <h2 className={styles.sectionTitle}>Drive assumptions</h2>
        <p className={styles.sectionLead}>
          Used when a property and a home base have coordinates. Straight-line miles stand in for
          road miles until live traffic is connected.
        </p>
        <div className={styles.assumptionGrid}>
          <label className={styles.field}>
            <span>Average speed (mph)</span>
            <input
              type="number"
              name="travel_speed_mph"
              min={5}
              max={70}
              step={1}
              value={policy.assumptions.travelSpeedMph}
              disabled={readOnly || pending}
              onChange={(event) =>
                setPolicy((current) => ({
                  ...current,
                  assumptions: {
                    ...current.assumptions,
                    travelSpeedMph: Number(event.target.value),
                  },
                }))
              }
            />
          </label>
          <label className={styles.field}>
            <span>Buffer between jobs (minutes)</span>
            <input
              type="number"
              name="buffer_minutes"
              min={0}
              max={120}
              step={5}
              value={policy.assumptions.bufferMinutes}
              disabled={readOnly || pending}
              onChange={(event) =>
                setPolicy((current) => ({
                  ...current,
                  assumptions: {
                    ...current.assumptions,
                    bufferMinutes: Number(event.target.value),
                  },
                }))
              }
            />
          </label>
          <label className={styles.field}>
            <span>Drive that scores as too far (minutes)</span>
            <input
              type="number"
              name="max_drive_minutes"
              min={5}
              max={180}
              step={5}
              value={policy.assumptions.maxDriveMinutes}
              disabled={readOnly || pending}
              onChange={(event) =>
                setPolicy((current) => ({
                  ...current,
                  assumptions: {
                    ...current.assumptions,
                    maxDriveMinutes: Number(event.target.value),
                  },
                }))
              }
            />
          </label>
        </div>
      </section>

      <label className={styles.searchField}>
        <span>Find a factor</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Pets, drive, commercial, weekend…"
        />
      </label>

      {SCHEDULE_FACTOR_CATEGORIES.map((category) => {
        const factors = SCHEDULE_FACTORS.filter((factor) => factor.category === category);
        const anyVisible = factors.some((factor) =>
          visibleFactors.some((item) => item.id === factor.id),
        );
        if (factors.length === 0) return null;
        return (
          <section key={category} className={styles.panel} hidden={!anyVisible}>
            <h2 className={styles.sectionTitle}>{category}</h2>
            <ul className={styles.factorList}>
              {factors.map((factor) => {
                const setting = policy.factors[factor.id];
                if (!setting) return null;
                const visible = visibleFactors.some((item) => item.id === factor.id);
                return (
                  <li key={factor.id} className={styles.factor} hidden={!visible}>
                    <label className={styles.enable}>
                      <input
                        type="checkbox"
                        name={`factor__${factor.id}__enabled`}
                        checked={setting.enabled}
                        disabled={readOnly || pending}
                        onChange={(event) =>
                          patchFactor(factor.id, { enabled: event.target.checked })
                        }
                      />
                      <span>
                        <span className={styles.factorLabel}>{factor.label}</span>
                        <span className={styles.factorDescription}>{factor.description}</span>
                      </span>
                    </label>
                    <div className={styles.controls}>
                      <label className={styles.weight}>
                        <span>Weight {setting.weight}</span>
                        <input
                          type="range"
                          name={`factor__${factor.id}__weight`}
                          min={0}
                          max={100}
                          step={5}
                          value={setting.weight}
                          disabled={readOnly || pending || !setting.enabled}
                          onChange={(event) =>
                            patchFactor(factor.id, { weight: Number(event.target.value) })
                          }
                        />
                      </label>
                      {factor.allowHard && !factorIsForcedHard(factor.id) ? (
                        <label className={styles.mode}>
                          <span>Rule</span>
                          <select
                            name={`factor__${factor.id}__mode`}
                            value={setting.mode}
                            disabled={readOnly || pending || !setting.enabled}
                            onChange={(event) =>
                              patchFactor(factor.id, {
                                mode: event.target.value === 'hard' ? 'hard' : 'soft',
                              })
                            }
                          >
                            <option value="soft">Prefer</option>
                            <option value="hard">Require</option>
                          </select>
                        </label>
                      ) : (
                        <input
                          type="hidden"
                          name={`factor__${factor.id}__mode`}
                          value={setting.mode}
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {state.error ? (
        <p className={styles.bannerError} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.bannerSuccess} role="status">
          Saved.
        </p>
      ) : null}

      {!readOnly ? (
        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save scheduling weights'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
