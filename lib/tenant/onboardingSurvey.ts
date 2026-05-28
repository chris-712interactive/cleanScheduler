import type { Tables } from '@/lib/supabase/database.types';

export type TenantOnboardingProfileRow = Pick<
  Tables<'tenant_onboarding_profiles'>,
  'service_area' | 'team_size' | 'referral_source' | 'survey_dismissed_at'
>;

/** True when post-signup survey fields are still blank and not dismissed. */
export function needsOnboardingSurvey(profile: TenantOnboardingProfileRow | null): boolean {
  if (!profile) return false;
  if (profile.survey_dismissed_at) return false;
  return !profile.service_area?.trim() || !profile.team_size?.trim();
}
