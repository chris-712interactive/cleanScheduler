import type { Tables } from '@/lib/supabase/database.types';

export type TenantOnboardingProfileRow = Pick<
  Tables<'tenant_onboarding_profiles'>,
  'service_area' | 'team_size' | 'referral_source'
>;

/** True when post-signup survey fields are still blank. */
export function needsOnboardingSurvey(profile: TenantOnboardingProfileRow | null): boolean {
  if (!profile) return false;
  return !profile.service_area?.trim() || !profile.team_size?.trim();
}
