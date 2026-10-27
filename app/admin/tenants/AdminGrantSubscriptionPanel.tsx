'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import {
  grantTenantSubscriptionAction,
  returnGrantedSubscriptionToTrialAction,
  type GrantTenantSubscriptionFormState,
} from '@/lib/admin/grantTenantSubscriptionAction';
import { PLATFORM_PLAN_LABELS, type PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import type { PlatformBillingInterval } from '@/lib/billing/platformPlans';
import styles from './tenants.module.scss';

const initialState: GrantTenantSubscriptionFormState = {};

const PLAN_OPTIONS: PlatformPlanTier[] = ['starter', 'business', 'pro'];

export function AdminGrantSubscriptionPanel({
  tenantId,
  tenantSlug,
  blockedReason,
  canReturnToTrial,
  currentPlan,
  currentInterval,
  hasStripeCustomer,
}: {
  tenantId: string;
  tenantSlug: string;
  blockedReason: string | null;
  canReturnToTrial: boolean;
  currentPlan: PlatformPlanTier | null;
  currentInterval: PlatformBillingInterval | null;
  hasStripeCustomer: boolean;
}) {
  const [grantState, grantAction, grantPending] = useActionState(
    grantTenantSubscriptionAction,
    initialState,
  );
  const [returnState, returnAction, returnPending] = useActionState(
    returnGrantedSubscriptionToTrialAction,
    initialState,
  );
  useFeedbackToast({ error: grantState.error, pending: grantPending });
  useFeedbackToast({ error: returnState.error, pending: returnPending });

  if (blockedReason) {
    return <p className={styles.hint}>{blockedReason}</p>;
  }

  const pending = grantPending || returnPending;

  return (
    <div className={styles.riskActions}>
      <form action={grantAction} className={styles.riskForm}>
        <input type="hidden" name="tenant_id" value={tenantId} />
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <p className={styles.hint}>
          Sets an active plan without Stripe Checkout and without a charge. Workspaces you leave
          alone still pick a plan and check out the same way they do today. A later Checkout
          replaces this grant.
        </p>
        {hasStripeCustomer ? (
          <p className={styles.hint}>
            This workspace already has a Stripe customer. An active Stripe subscription will replace
            this grant.
          </p>
        ) : null}
        <label className={styles.riskReasonLabel} htmlFor="grant-platform-plan">
          Plan
        </label>
        <select
          id="grant-platform-plan"
          name="platform_plan"
          className={styles.riskReasonInput}
          defaultValue={currentPlan ?? 'starter'}
          required
        >
          {PLAN_OPTIONS.map((plan) => (
            <option key={plan} value={plan}>
              {PLATFORM_PLAN_LABELS[plan]}
            </option>
          ))}
        </select>
        <label className={styles.riskReasonLabel} htmlFor="grant-billing-interval">
          Billing cycle
        </label>
        <select
          id="grant-billing-interval"
          name="billing_interval"
          className={styles.riskReasonInput}
          defaultValue={currentInterval ?? 'month'}
          required
        >
          <option value="month">Monthly</option>
          <option value="year">Yearly</option>
        </select>
        <Button type="submit" variant="secondary" disabled={pending}>
          {grantPending ? 'Saving…' : 'Set active plan'}
        </Button>
      </form>
      {canReturnToTrial ? (
        <form action={returnAction} className={styles.riskForm}>
          <input type="hidden" name="tenant_id" value={tenantId} />
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <p className={styles.hint}>
            Puts the workspace back on the free trial so the plan picker and Checkout show up again.
            A trial that already ended gets 7 more days.
          </p>
          <Button type="submit" variant="secondary" disabled={pending}>
            {returnPending ? 'Returning…' : 'Return to free trial'}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
