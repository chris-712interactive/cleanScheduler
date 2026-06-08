import type { ServiceTemplateScheduleRole } from '@/lib/tenant/defaultJobTypeCatalog';

export const SCHEDULE_ROLE_OPTIONS: {
  value: ServiceTemplateScheduleRole;
  label: string;
  hint: string;
}[] = [
  {
    value: 'initial',
    label: 'Initial visit',
    hint: 'First cleaning after quote acceptance when auto-scheduling is enabled.',
  },
  {
    value: 'recurring',
    label: 'Recurring visit',
    hint: 'Ongoing cadence after initial work is scheduled.',
  },
  {
    value: 'standard',
    label: 'Standard',
    hint: 'No special auto-schedule role; visits follow quote line flags only.',
  },
];

export const SCHEDULE_ROLE_LABEL: Record<ServiceTemplateScheduleRole, string> = {
  initial: 'Initial visit',
  recurring: 'Recurring visit',
  standard: 'Standard',
};

export function parseScheduleRole(raw: string): ServiceTemplateScheduleRole | null {
  if (raw === 'initial' || raw === 'recurring' || raw === 'standard') return raw;
  return null;
}
