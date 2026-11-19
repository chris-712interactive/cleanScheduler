import {
  effectiveSchedulingFacts,
  schedulingFactsFromRow,
  type SchedulingFactsRow,
} from '@/lib/schedule/optimizer/preferences';

const EMPTY_FACTS: SchedulingFactsRow = {
  preferred_user_ids: [],
  required_user_ids: [],
  blocked_user_ids: [],
  arrival_start: null,
  arrival_end: null,
  access_start: null,
  access_end: null,
  pet_in_home: false,
  chemical_sensitivity: false,
  language_codes: [],
  required_attribute_tags: [],
  priority: 3,
  required_skill_tags: [],
  required_certification_tags: [],
  required_equipment_tags: [],
  requires_key_pickup: false,
  preferred_weekdays: [],
  preferred_time_window: null,
};

export function hasFixedArrivalWindow(input: {
  arrivalStart: string | null;
  arrivalEnd: string | null;
  schedulingOverride: unknown;
}): boolean {
  const facts = effectiveSchedulingFacts(
    schedulingFactsFromRow({
      ...EMPTY_FACTS,
      arrival_start: input.arrivalStart,
      arrival_end: input.arrivalEnd,
    }),
    input.schedulingOverride,
  );
  return facts.arrivalWindow != null;
}

/**
 * A stop stays in time order when the customer has a specific arrival window,
 * the visit is a consultation, or the work has already started or finished.
 * Morning, afternoon, and evening preferences stay flexible.
 */
export function isVisitTimeLocked(input: {
  status: string;
  checkedInAt: string | null;
  visitPurpose: string | null;
  hasFixedArrivalWindow: boolean;
}): boolean {
  if (input.status === 'completed') return true;
  if (input.checkedInAt) return true;
  if (input.visitPurpose === 'consultation') return true;
  return input.hasFixedArrivalWindow;
}

export function canApplyStopOrder(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}
