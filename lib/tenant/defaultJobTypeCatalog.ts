import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import { PROPERTY_KIND_OPTIONS } from '@/lib/tenant/propertyKindLabels';

export type ServiceTemplateScheduleRole = 'initial' | 'recurring' | 'standard';

export type DefaultJobTypeDefinition = {
  serviceLabel: string;
  /** Display name in settings (usually matches service label). */
  name: string;
  hoursByPropertyKind: Partial<Record<CustomerPropertyKind, number>>;
  sortOrder: number;
  scheduleRole: ServiceTemplateScheduleRole;
};

/** Built-in job types seeded for every tenant; durations are editable in settings. */
export const DEFAULT_JOB_TYPE_CATALOG: DefaultJobTypeDefinition[] = [
  {
    serviceLabel: 'Deep cleaning',
    name: 'Deep cleaning',
    sortOrder: 0,
    scheduleRole: 'initial',
    hoursByPropertyKind: {
      residential: 4,
      commercial: 6,
      short_term_rental: 3,
      other: 4,
    },
  },
  {
    serviceLabel: 'Standard cleaning',
    name: 'Standard cleaning',
    sortOrder: 1,
    scheduleRole: 'recurring',
    hoursByPropertyKind: {
      residential: 2,
      commercial: 3,
      short_term_rental: 2,
      other: 2,
    },
  },
  {
    serviceLabel: 'Move-out deep clean',
    name: 'Move-out deep clean',
    sortOrder: 2,
    scheduleRole: 'initial',
    hoursByPropertyKind: {
      residential: 5,
      commercial: 8,
      short_term_rental: 4,
      other: 5,
    },
  },
  {
    serviceLabel: 'Initial / first clean',
    name: 'Initial / first clean',
    sortOrder: 3,
    scheduleRole: 'initial',
    hoursByPropertyKind: {
      residential: 3,
      commercial: 4,
      short_term_rental: 3,
      other: 3,
    },
  },
];

export const DEFAULT_JOB_TYPE_PROPERTY_KINDS: CustomerPropertyKind[] = PROPERTY_KIND_OPTIONS.map(
  (option) => option.value,
);

export function defaultHoursForJobType(
  definition: DefaultJobTypeDefinition,
  propertyKind: CustomerPropertyKind,
): number {
  return definition.hoursByPropertyKind[propertyKind] ?? definition.hoursByPropertyKind.other ?? 2;
}
