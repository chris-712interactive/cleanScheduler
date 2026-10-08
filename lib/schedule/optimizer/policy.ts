import {
  defaultFactorSetting,
  factorIsForcedHard,
  SCHEDULE_FACTORS,
  type ScheduleFactorId,
} from '@/lib/schedule/optimizer/factors';
import type {
  FactorMode,
  FactorSetting,
  ScheduleOptimizerAssumptions,
  ScheduleOptimizerPolicy,
} from '@/lib/schedule/optimizer/types';

export const DEFAULT_SCHEDULING_ASSUMPTIONS: ScheduleOptimizerAssumptions = {
  travelSpeedMph: 25,
  bufferMinutes: 15,
  maxDriveMinutes: 45,
};

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseMode(
  value: unknown,
  allowHard: boolean,
  forceHard: boolean | undefined,
  fallback: FactorMode,
): FactorMode {
  if (forceHard) return 'hard';
  if (!allowHard) return 'soft';
  return value === 'hard' || value === 'soft' ? value : fallback;
}

function parseFactorSetting(id: ScheduleFactorId, raw: unknown): FactorSetting {
  const defaults = defaultFactorSetting(id);
  const factor = SCHEDULE_FACTORS.find((entry) => entry.id === id);
  if (!factor || !isRecord(raw)) return defaults;
  const weight = clampNumber(Number(raw.weight), 0, 100, defaults.weight);
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : defaults.enabled,
    weight: Math.round(weight),
    mode: parseMode(raw.mode, factor.allowHard, factorIsForcedHard(factor.id), defaults.mode),
  };
}

export function defaultScheduleOptimizerPolicy(): ScheduleOptimizerPolicy {
  const factors: Record<string, FactorSetting> = {};
  for (const factor of SCHEDULE_FACTORS) {
    factors[factor.id] = defaultFactorSetting(factor.id);
  }
  return {
    factors,
    assumptions: { ...DEFAULT_SCHEDULING_ASSUMPTIONS },
  };
}

/** Fills anything missing or out of range so old saved policies stay valid as factors are added. */
export function resolveScheduleOptimizerPolicy(raw: unknown): ScheduleOptimizerPolicy {
  const defaults = defaultScheduleOptimizerPolicy();
  if (!isRecord(raw)) return defaults;

  const rawFactors = isRecord(raw.factors) ? raw.factors : {};
  const factors: Record<string, FactorSetting> = {};
  for (const factor of SCHEDULE_FACTORS) {
    factors[factor.id] = parseFactorSetting(factor.id, rawFactors[factor.id]);
  }

  const rawAssumptions = isRecord(raw.assumptions) ? raw.assumptions : {};
  return {
    factors,
    assumptions: {
      travelSpeedMph: clampNumber(
        Number(rawAssumptions.travelSpeedMph),
        5,
        70,
        defaults.assumptions.travelSpeedMph,
      ),
      bufferMinutes: Math.round(
        clampNumber(
          Number(rawAssumptions.bufferMinutes),
          0,
          120,
          defaults.assumptions.bufferMinutes,
        ),
      ),
      maxDriveMinutes: Math.round(
        clampNumber(
          Number(rawAssumptions.maxDriveMinutes),
          5,
          180,
          defaults.assumptions.maxDriveMinutes,
        ),
      ),
    },
  };
}

export function countEnabledScheduleFactors(policy: ScheduleOptimizerPolicy): number {
  return SCHEDULE_FACTORS.filter((factor) => policy.factors[factor.id]?.enabled).length;
}

export type SchedulePolicyPresetId =
  'balanced' | 'residential_routes' | 'commercial_sites' | 'even_workload';

const PRESET_OVERLAYS: Record<
  Exclude<SchedulePolicyPresetId, 'balanced'>,
  Record<string, Partial<FactorSetting>>
> = {
  residential_routes: {
    skill_match: { mode: 'soft', weight: 25 },
    certification_match: { enabled: false, weight: 10 },
    equipment_match: { mode: 'soft', weight: 20 },
    travel_distance: { weight: 100 },
    route_efficiency: { weight: 95 },
    zone_clustering: { weight: 90 },
    same_building_batch: { weight: 35 },
    recurring_continuity: { weight: 100 },
    preferred_cleaner: { weight: 90 },
    pet_comfort: { weight: 80, mode: 'hard' },
  },
  commercial_sites: {
    skill_match: { weight: 100, mode: 'hard' },
    certification_match: { weight: 100, mode: 'hard' },
    equipment_match: { weight: 90, mode: 'hard' },
    site_access_hours: { weight: 100, mode: 'hard' },
    crew_size: { weight: 100 },
    attribute_match: { weight: 70, mode: 'hard' },
    same_building_batch: { weight: 85 },
    travel_distance: { weight: 55 },
    recurring_continuity: { weight: 40 },
    language_match: { weight: 60, mode: 'hard' },
  },
  even_workload: {
    workload_balance: { weight: 100 },
    weekend_fairness: { weight: 80 },
    overtime_avoidance: { weight: 90 },
    max_jobs_per_day: { weight: 100, mode: 'hard' },
    max_hours_per_day: { weight: 100, mode: 'hard' },
    travel_distance: { weight: 40 },
    recurring_continuity: { weight: 50 },
  },
};

/** Starting weights for a business shape. Saving still requires the settings form. */
export function schedulePolicyPreset(id: SchedulePolicyPresetId): ScheduleOptimizerPolicy {
  const policy = defaultScheduleOptimizerPolicy();
  if (id === 'balanced') return policy;
  const overlay = PRESET_OVERLAYS[id];
  for (const [factorId, patch] of Object.entries(overlay)) {
    const current = policy.factors[factorId];
    if (!current) continue;
    policy.factors[factorId] = { ...current, ...patch };
  }
  return resolveScheduleOptimizerPolicy(policy);
}

export function factorIsActive(
  policy: ScheduleOptimizerPolicy,
  id: ScheduleFactorId,
): FactorSetting | null {
  const setting = policy.factors[id];
  if (!setting?.enabled) return null;
  return setting;
}

export function parseScheduleOptimizerPolicyFromForm(formData: FormData): ScheduleOptimizerPolicy {
  const defaults = defaultScheduleOptimizerPolicy();
  const factors: Record<string, FactorSetting> = {};
  for (const factor of SCHEDULE_FACTORS) {
    const weight = clampNumber(
      Number(formData.get(`factor__${factor.id}__weight`)),
      0,
      100,
      defaults.factors[factor.id]?.weight ?? factor.defaultWeight,
    );
    factors[factor.id] = {
      enabled: formData.get(`factor__${factor.id}__enabled`) === 'on',
      weight: Math.round(weight),
      mode: parseMode(
        formData.get(`factor__${factor.id}__mode`),
        factor.allowHard,
        factorIsForcedHard(factor.id),
        'soft',
      ),
    };
  }

  return resolveScheduleOptimizerPolicy({
    factors,
    assumptions: {
      travelSpeedMph: Number(formData.get('travel_speed_mph')),
      bufferMinutes: Number(formData.get('buffer_minutes')),
      maxDriveMinutes: Number(formData.get('max_drive_minutes')),
    },
  });
}
