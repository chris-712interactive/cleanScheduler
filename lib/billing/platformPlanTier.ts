export type PlatformPlanTier = 'starter' | 'pro' | 'business';

export const PLATFORM_PLAN_LABELS: Record<PlatformPlanTier, string> = {
  starter: 'Starter',
  pro: 'Pro',
  business: 'Business',
};

/** Short positioning copy for onboarding (final pricing lives in Stripe). */
export const PLATFORM_PLAN_DESCRIPTIONS: Record<PlatformPlanTier, string> = {
  starter: 'Solo / small teams — core scheduling, quotes, and invoicing.',
  pro: 'Growing teams — recurring billing & deeper reports.',
  business: 'Larger ops — higher limits and advanced capabilities.',
};

export function parsePlatformPlanTier(raw: string | null | undefined): PlatformPlanTier | null {
  const v = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (v === 'starter' || v === 'pro' || v === 'business') return v;
  return null;
}
