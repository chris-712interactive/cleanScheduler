import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { normalizePaymentMethodsFromDb } from '@/lib/tenant/operationalSettings';
import {
  isFeatureEnabled,
  resolveTenantEntitlementPlan,
  resolveTenantSubscriptionTier,
} from '@/lib/billing/entitlements';
import {
  countSmsSegmentsUsedThisMonth,
  formatSmsUsageSummary,
  resolveTenantSmsCommunicationAllowed,
} from '@/lib/billing/smsCredits';
import { canUseSmsCommunication } from '@/lib/billing/tenantSubscriptionAccess';
import { isSentDmConfigured } from '@/lib/sms/sentDmServer';
import { normalizeMessagingChannelsFromDb } from '@/lib/sms/sentMessagingChannels';
import { OperationalSettingsForm } from '../OperationalSettingsForm';
import styles from '../settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantOperationsSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/operations');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();
  const [{ data: billing }, plan, subscriptionTier, smsAllowed] = await Promise.all([
    admin
      .from('tenant_billing_accounts')
      .select('status')
      .eq('tenant_id', membership.tenantId)
      .maybeSingle(),
    resolveTenantEntitlementPlan(admin, membership.tenantId),
    resolveTenantSubscriptionTier(admin, membership.tenantId),
    resolveTenantSmsCommunicationAllowed(admin, membership.tenantId),
  ]);
  const smsTierEnabled = isFeatureEnabled(plan, 'smsCommunication');
  const smsTrialLocked = smsTierEnabled && !canUseSmsCommunication(billing?.status);
  const sentDmConfigured = isSentDmConfigured();
  const smsUsed = smsAllowed ? await countSmsSegmentsUsedThisMonth(admin, membership.tenantId) : 0;
  const invoiceReminderEmailEditable = isFeatureEnabled(plan, 'salesTaxSummary');
  const invoiceReminderSmsEditable = smsAllowed;

  const supabase = createTenantPortalDbClient();
  const { data: opsRow } = await supabase
    .from('tenant_operational_settings')
    .select(
      'accepted_quote_schedule_mode, invoice_expectation, allowed_customer_payment_methods, email_notify_quote_sent, email_notify_quote_accepted, email_notify_quote_declined, sms_notify_quote_sent, sms_notify_quote_accepted, sms_notify_quote_declined, sms_notify_visit_reminder, email_notify_invoice_overdue, sms_notify_invoice_overdue, check_reminder_hold_days, check_hold_through_deposit, messaging_channels',
    )
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();

  const opsSnapshot = opsRow
    ? {
        accepted_quote_schedule_mode: opsRow.accepted_quote_schedule_mode,
        invoice_expectation: opsRow.invoice_expectation,
        allowed_customer_payment_methods: normalizePaymentMethodsFromDb(
          opsRow.allowed_customer_payment_methods,
        ),
        email_notify_quote_sent: opsRow.email_notify_quote_sent,
        email_notify_quote_accepted: opsRow.email_notify_quote_accepted,
        email_notify_quote_declined: opsRow.email_notify_quote_declined,
        sms_notify_quote_sent: opsRow.sms_notify_quote_sent,
        sms_notify_quote_accepted: opsRow.sms_notify_quote_accepted,
        sms_notify_quote_declined: opsRow.sms_notify_quote_declined,
        sms_notify_visit_reminder: opsRow.sms_notify_visit_reminder,
        email_notify_invoice_overdue: opsRow.email_notify_invoice_overdue,
        sms_notify_invoice_overdue: opsRow.sms_notify_invoice_overdue,
        check_reminder_hold_days: opsRow.check_reminder_hold_days,
        check_hold_through_deposit: opsRow.check_hold_through_deposit,
        messaging_channels: normalizeMessagingChannelsFromDb(opsRow.messaging_channels),
      }
    : {
        accepted_quote_schedule_mode: 'prompt_staff' as const,
        invoice_expectation: 'pay_after_service' as const,
        allowed_customer_payment_methods: normalizePaymentMethodsFromDb(undefined),
        email_notify_quote_sent: true,
        email_notify_quote_accepted: true,
        email_notify_quote_declined: true,
        sms_notify_quote_sent: false,
        sms_notify_quote_accepted: false,
        sms_notify_quote_declined: false,
        sms_notify_visit_reminder: false,
        email_notify_invoice_overdue: true,
        sms_notify_invoice_overdue: false,
        check_reminder_hold_days: 7,
        check_hold_through_deposit: false,
        messaging_channels: normalizeMessagingChannelsFromDb(undefined),
      };

  return (
    <>
      <PageHeader
        title="Operations"
        titleHint="Defaults for quotes, scheduling, customer payments, and notifications."
        backHref="/settings"
        backLabel="Settings"
      />

      {!canEdit ? (
        <p className={styles.readOnlyNotice} role="status">
          You can view operational settings here. Only owners and admins can make changes.
        </p>
      ) : null}

      {smsAllowed ? (
        <p className={styles.opsIntro} style={{ marginBottom: 'var(--space-4)' }}>
          SMS usage: {formatSmsUsageSummary(smsUsed, subscriptionTier ?? 'pro')}.{' '}
          <Link href="/billing">Upgrade plan</Link>
        </p>
      ) : smsTrialLocked ? (
        <p className={styles.opsIntro} style={{ marginBottom: 'var(--space-4)' }} role="status">
          SMS is included with Pro after you subscribe.{' '}
          <Link href="/billing">Add a payment method</Link> to unlock quote and visit reminder
          texts.
        </p>
      ) : (
        <FeatureUpgradePanel
          title="Upgrade to unlock SMS notifications"
          description="Pro includes SMS customer communication — quote alerts, visit reminders, and 25,000 segments per month."
        />
      )}

      <Card
        title="Quotes, scheduling & customer payments"
        description="Defaults for quotes, scheduling, payments, and email/SMS notifications."
      >
        <OperationalSettingsForm
          tenantSlug={membership.tenantSlug}
          snapshot={opsSnapshot}
          readOnly={!canEdit}
          smsEditable={smsAllowed}
          smsTrialLocked={smsTrialLocked}
          sentDmConfigured={sentDmConfigured}
          invoiceReminderEmailEditable={invoiceReminderEmailEditable}
          invoiceReminderSmsEditable={invoiceReminderSmsEditable}
        />
      </Card>
    </>
  );
}
