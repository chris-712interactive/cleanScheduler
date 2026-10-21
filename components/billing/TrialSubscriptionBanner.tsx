import { RegisterAccountNotice } from '@/components/portal/accountNotices/RegisterAccountNotice';
import { buildTrialAccountNotice } from '@/lib/billing/accountNotices';
import type { TenantSubscriptionAccess } from '@/lib/billing/tenantSubscriptionAccess';

export interface TrialSubscriptionBannerProps {
  access: TenantSubscriptionAccess;
  daysRemaining: number | null;
}

/** Publishes the trial reminder into the header notice chip. */
export function TrialSubscriptionBanner({ access, daysRemaining }: TrialSubscriptionBannerProps) {
  const notice = buildTrialAccountNotice(access, daysRemaining);
  if (!notice) return null;
  return <RegisterAccountNotice notice={notice} />;
}
