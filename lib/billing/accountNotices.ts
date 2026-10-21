import type { Enums } from '@/lib/supabase/database.types';
import type { TenantSubscriptionAccess } from '@/lib/billing/tenantSubscriptionAccess';
import type { UtilizationAlert } from '@/lib/billing/usageUtilization';
import { utilizationBannerMessage } from '@/lib/billing/usageUtilization';

type TenantStripeConnectStatus = Enums<'tenant_stripe_connect_status'>;

export type AccountNoticeTone = 'info' | 'warning';

/** A billing or setup reminder shown in the workspace header instead of a full-width bar. */
export interface AccountNotice {
  id: string;
  tone: AccountNoticeTone;
  /** Higher values sort first on the chip and in the menu. */
  priority: number;
  /** Short label on the header chip, e.g. "Trial · 18 days". */
  label: string;
  /** Sentence shown when the notice is opened. */
  detail: string;
  href: string;
  actionLabel: string;
}

export function buildTrialAccountNotice(
  access: TenantSubscriptionAccess,
  daysRemaining: number | null,
): AccountNotice | null {
  if (access === 'active' || access === 'suspended' || access === 'trial_expired') {
    return null;
  }

  if (access === 'past_due') {
    return {
      id: 'trial',
      tone: 'warning',
      priority: 100,
      label: 'Payment past due',
      detail: 'Update billing to avoid losing access.',
      href: '/billing',
      actionLabel: 'Update billing',
    };
  }

  if (daysRemaining === 0) {
    return {
      id: 'trial',
      tone: 'warning',
      priority: 90,
      label: 'Trial ends today',
      detail: 'Subscribe to keep access.',
      href: '/billing',
      actionLabel: 'Subscribe',
    };
  }

  if (daysRemaining != null && daysRemaining <= 3) {
    return {
      id: 'trial',
      tone: 'warning',
      priority: 80,
      label: daysRemaining === 1 ? 'Trial · 1 day' : `Trial · ${daysRemaining} days`,
      detail: 'Subscribe before the trial ends to keep this workspace.',
      href: '/billing',
      actionLabel: 'Subscribe',
    };
  }

  return {
    id: 'trial',
    tone: 'info',
    priority: 20,
    label: daysRemaining == null ? 'Free trial' : `Trial · ${daysRemaining} days`,
    detail: 'Quotes, scheduling, and invoicing are included.',
    href: '/billing',
    actionLabel: 'Choose a plan',
  };
}

export function buildUsageAccountNotice(alert: UtilizationAlert): AccountNotice {
  const urgent = alert.level === 'critical' || alert.level === 'exceeded';
  const pct = Math.round(alert.ratio * 100);

  return {
    id: 'usage',
    tone: urgent ? 'warning' : 'info',
    priority: alert.level === 'exceeded' ? 70 : alert.level === 'critical' ? 60 : 40,
    label: alert.level === 'exceeded' ? `${alert.label} full` : `${alert.label} ${pct}%`,
    detail: utilizationBannerMessage(alert),
    href: '/billing',
    actionLabel: 'View billing',
  };
}

const CONNECT_NOTICES: Record<
  Exclude<TenantStripeConnectStatus, 'complete'>,
  Omit<AccountNotice, 'id'>
> = {
  not_started: {
    tone: 'info',
    priority: 15,
    label: 'Card payments',
    detail: 'Connect Stripe to collect card payments. Cash, check, and Zelle still work.',
    href: '/billing/payment-setup',
    actionLabel: 'Set up cards',
  },
  pending: {
    tone: 'info',
    priority: 25,
    label: 'Card setup',
    detail: 'Finish Stripe verification so card payments can go live.',
    href: '/billing/payment-setup',
    actionLabel: 'Continue setup',
  },
  restricted: {
    tone: 'warning',
    priority: 55,
    label: 'Card payments blocked',
    detail: 'Stripe flagged the connected account. Review the requirements in Payment setup.',
    href: '/billing/payment-setup',
    actionLabel: 'Review',
  },
};

export function buildConnectAccountNotice(status: TenantStripeConnectStatus): AccountNotice | null {
  if (status === 'complete') return null;
  const notice = CONNECT_NOTICES[status] ?? CONNECT_NOTICES.not_started;
  return { id: 'connect', ...notice };
}
