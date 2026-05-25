import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

export const CHECKLIST_SNOOZE_DAYS = 7;

export type OwnerOnboardingProfileChecklistState = {
  checklist_dismissed_at: string | null;
  checklist_snoozed_until: string | null;
  checklist_completed_at: string | null;
  checklist_optional_skips: string[];
  checklist_completion_acknowledged_at: string | null;
  survey_dismissed_at: string | null;
};

const CHECKLIST_STATE_COLUMNS =
  'checklist_dismissed_at, checklist_snoozed_until, checklist_completed_at, checklist_optional_skips, checklist_completion_acknowledged_at, survey_dismissed_at';

const EMPTY_STATE: OwnerOnboardingProfileChecklistState = {
  checklist_dismissed_at: null,
  checklist_snoozed_until: null,
  checklist_completed_at: null,
  checklist_optional_skips: [],
  checklist_completion_acknowledged_at: null,
  survey_dismissed_at: null,
};

export async function loadOwnerOnboardingProfileState(
  admin: Admin,
  tenantId: string,
): Promise<OwnerOnboardingProfileChecklistState> {
  const { data, error } = await admin
    .from('tenant_onboarding_profiles')
    .select(CHECKLIST_STATE_COLUMNS)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) {
    return EMPTY_STATE;
  }

  return {
    checklist_dismissed_at: data.checklist_dismissed_at,
    checklist_snoozed_until: data.checklist_snoozed_until,
    checklist_completed_at: data.checklist_completed_at,
    checklist_optional_skips: data.checklist_optional_skips ?? [],
    checklist_completion_acknowledged_at: data.checklist_completion_acknowledged_at,
    survey_dismissed_at: data.survey_dismissed_at,
  };
}

export async function ensureOwnerOnboardingProfileRow(admin: Admin, tenantId: string): Promise<void> {
  const { data } = await admin
    .from('tenant_onboarding_profiles')
    .select('id')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (data?.id) return;

  await admin.from('tenant_onboarding_profiles').insert({ tenant_id: tenantId });
}

export async function markChecklistCompleted(admin: Admin, tenantId: string): Promise<void> {
  await ensureOwnerOnboardingProfileRow(admin, tenantId);
  const nowIso = new Date().toISOString();
  await admin
    .from('tenant_onboarding_profiles')
    .update({
      checklist_completed_at: nowIso,
      checklist_snoozed_until: null,
      checklist_dismissed_at: null,
    })
    .eq('tenant_id', tenantId)
    .is('checklist_completed_at', null);
}

export async function snoozeOwnerChecklist(admin: Admin, tenantId: string): Promise<void> {
  await ensureOwnerOnboardingProfileRow(admin, tenantId);
  const until = new Date();
  until.setUTCDate(until.getUTCDate() + CHECKLIST_SNOOZE_DAYS);
  await admin
    .from('tenant_onboarding_profiles')
    .update({
      checklist_snoozed_until: until.toISOString(),
      checklist_dismissed_at: null,
    })
    .eq('tenant_id', tenantId)
    .is('checklist_completed_at', null);
}

export async function dismissOwnerChecklist(admin: Admin, tenantId: string): Promise<void> {
  await ensureOwnerOnboardingProfileRow(admin, tenantId);
  await admin
    .from('tenant_onboarding_profiles')
    .update({
      checklist_dismissed_at: new Date().toISOString(),
      checklist_snoozed_until: null,
    })
    .eq('tenant_id', tenantId)
    .is('checklist_completed_at', null);
}

export async function reopenOwnerChecklist(admin: Admin, tenantId: string): Promise<void> {
  await ensureOwnerOnboardingProfileRow(admin, tenantId);
  await admin
    .from('tenant_onboarding_profiles')
    .update({
      checklist_dismissed_at: null,
      checklist_snoozed_until: null,
    })
    .eq('tenant_id', tenantId)
    .is('checklist_completed_at', null);
}

export async function skipOptionalChecklistStep(
  admin: Admin,
  tenantId: string,
  stepId: string,
): Promise<void> {
  const state = await loadOwnerOnboardingProfileState(admin, tenantId);
  if (state.checklist_optional_skips.includes(stepId)) return;

  await ensureOwnerOnboardingProfileRow(admin, tenantId);
  await admin
    .from('tenant_onboarding_profiles')
    .update({
      checklist_optional_skips: [...state.checklist_optional_skips, stepId],
    })
    .eq('tenant_id', tenantId);
}

export async function acknowledgeChecklistCompletion(admin: Admin, tenantId: string): Promise<void> {
  await ensureOwnerOnboardingProfileRow(admin, tenantId);
  await admin
    .from('tenant_onboarding_profiles')
    .update({
      checklist_completion_acknowledged_at: new Date().toISOString(),
    })
    .eq('tenant_id', tenantId)
    .is('checklist_completion_acknowledged_at', null);
}

export async function dismissOwnerSurvey(admin: Admin, tenantId: string): Promise<void> {
  await ensureOwnerOnboardingProfileRow(admin, tenantId);
  await admin
    .from('tenant_onboarding_profiles')
    .update({ survey_dismissed_at: new Date().toISOString() })
    .eq('tenant_id', tenantId)
    .is('survey_dismissed_at', null);
}

export type ChecklistUiState = 'visible' | 'dismissed' | 'snoozed' | 'complete';

export function resolveChecklistUiState(
  state: OwnerOnboardingProfileChecklistState,
  now: Date = new Date(),
): ChecklistUiState {
  if (state.checklist_completed_at) return 'complete';

  const snoozedUntil = state.checklist_snoozed_until
    ? new Date(state.checklist_snoozed_until).getTime()
    : null;
  if (snoozedUntil != null && !Number.isNaN(snoozedUntil) && snoozedUntil > now.getTime()) {
    return 'snoozed';
  }

  if (state.checklist_dismissed_at) return 'dismissed';
  return 'visible';
}

export function shouldShowDashboardChecklistCard(uiState: ChecklistUiState): boolean {
  return uiState === 'visible';
}

export function isDashboardOnboardingFocusMode(
  checklist: { uiState: ChecklistUiState; incompleteRequiredCount: number } | null,
): boolean {
  if (!checklist) return false;
  return (
    shouldShowDashboardChecklistCard(checklist.uiState) && checklist.incompleteRequiredCount > 0
  );
}

export function shouldShowGettingStartedNav(
  uiState: ChecklistUiState,
  incompleteRequiredCount: number,
): boolean {
  return uiState !== 'complete' && incompleteRequiredCount > 0;
}

export function shouldShowCompletionCelebration(
  state: OwnerOnboardingProfileChecklistState,
): boolean {
  return Boolean(state.checklist_completed_at && !state.checklist_completion_acknowledged_at);
}
