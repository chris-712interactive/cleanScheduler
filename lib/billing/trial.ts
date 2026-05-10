import { createClient } from '@/lib/supabase/server';

export interface TrialSummary {
  status: 'trialing' | 'active' | 'past_due' | 'canceled';
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  daysRemaining: number | null;
}

function computeDaysRemaining(trialEndsAt: string | null): number | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt).getTime();
  const now = Date.now();
  const diff = end - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export async function getTenantTrialSummaryBySlug(slug: string): Promise<TrialSummary | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from('tenant_billing_accounts')
    .select(
      `
      status,
      trial_started_at,
      trial_ends_at,
      tenants:tenants!inner (
        slug
      )
    `,
    )
    .eq('tenants.slug', slug)
    .maybeSingle();

  if (error || !data) return null;

  return {
    status: data.status,
    trialStartedAt: data.trial_started_at ?? null,
    trialEndsAt: data.trial_ends_at ?? null,
    daysRemaining: computeDaysRemaining(data.trial_ends_at ?? null),
  };
}
