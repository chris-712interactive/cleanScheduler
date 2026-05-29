import type { OperationalSettingsFormSnapshot } from '@/lib/tenant/operationalSettingsFormSnapshot';

export interface OperationalSettingsFormState {
  error?: string;
  success?: boolean;
  settingsSnapshot?: OperationalSettingsFormSnapshot;
}

export const operationalSettingsFormInitial: OperationalSettingsFormState = {};
