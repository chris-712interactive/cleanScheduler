export const HIRING_GATE_KEYS = [
  'age_18',
  'transportation',
  'accepts_pay',
  'accepts_schedule',
  'background_check_willing',
  'work_authorized',
] as const;

export type HiringGateKey = (typeof HIRING_GATE_KEYS)[number];

export const HIRING_CONSENT_VERSION = 'hiring-consent-2026-10-26';

export const HIRING_CONSENT_COPY =
  'I agree that this company may email me about this application only. This company is the employer. Clean Scheduler delivers the message and does not hire me.';

export type HiringOpeningKind = 'field' | 'office';

export interface HiringQuestionToggles {
  require_transportation: boolean;
  require_accepts_pay: boolean;
  require_accepts_schedule: boolean;
  require_background_check_willing: boolean;
  require_work_authorized: boolean;
}

export const HIRING_GATE_LABELS: Record<HiringGateKey, string> = {
  age_18: 'Are you 18 or older?',
  transportation: 'Do you have reliable transportation to the job?',
  accepts_pay: 'Do you accept the pay shown above?',
  accepts_schedule: 'Can you work the days and hours shown above?',
  background_check_willing:
    'Are you willing to complete a background check before working in customer homes?',
  work_authorized: 'Are you authorized to work in the United States?',
};

export const HIRING_GATE_FAIL_REASONS: Record<HiringGateKey, string> = {
  age_18: 'applicants must be 18 or older',
  transportation: 'reliable transportation',
  accepts_pay: 'accepting the posted pay',
  accepts_schedule: 'the posted days and hours',
  background_check_willing: 'a background check before working in homes',
  work_authorized: 'authorization to work in the United States',
};

const TOGGLE_BY_GATE: Record<Exclude<HiringGateKey, 'age_18'>, keyof HiringQuestionToggles> = {
  transportation: 'require_transportation',
  accepts_pay: 'require_accepts_pay',
  accepts_schedule: 'require_accepts_schedule',
  background_check_willing: 'require_background_check_willing',
  work_authorized: 'require_work_authorized',
};

export function defaultQuestionToggles(kind: HiringOpeningKind): HiringQuestionToggles {
  return {
    require_transportation: kind === 'field',
    require_accepts_pay: true,
    require_accepts_schedule: true,
    require_background_check_willing: kind === 'field',
    require_work_authorized: false,
  };
}

/** Age is always asked. Other gates follow the opening toggles. */
export function activeHiringGates(toggles: HiringQuestionToggles): HiringGateKey[] {
  return HIRING_GATE_KEYS.filter((key) => {
    if (key === 'age_18') return true;
    return toggles[TOGGLE_BY_GATE[key]];
  });
}

export function screenHiringAnswers(
  toggles: HiringQuestionToggles,
  answers: Partial<Record<HiringGateKey, boolean>>,
): { pass: true } | { pass: false; reason: HiringGateKey } {
  for (const key of activeHiringGates(toggles)) {
    if (answers[key] !== true) {
      return { pass: false, reason: key };
    }
  }
  return { pass: true };
}

export function isHiringGateKey(value: string): value is HiringGateKey {
  return (HIRING_GATE_KEYS as readonly string[]).includes(value);
}
