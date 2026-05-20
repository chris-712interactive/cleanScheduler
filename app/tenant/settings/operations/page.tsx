import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { normalizePaymentMethodsFromDb } from '@/lib/tenant/operationalSettings';
import { OperationalSettingsForm } from '../OperationalSettingsForm';
import styles from '../settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantOperationsSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/operations');
  const canEdit = canManageTeamInvitesAndRoles(membership.role);

  const supabase = createTenantPortalDbClient();
  const { data: opsRow } = await supabase
    .from('tenant_operational_settings')
    .select(
      'accepted_quote_schedule_mode, invoice_expectation, allowed_customer_payment_methods, email_notify_quote_sent, email_notify_quote_accepted, email_notify_quote_declined, sms_notify_quote_sent, sms_notify_quote_accepted, sms_notify_quote_declined',
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

      <Card
        title="Quotes, scheduling & customer payments"
        description="Defaults for quotes, scheduling, payments, and Resend email notifications. SMS toggles are stored for a future release."
      >
        <OperationalSettingsForm
          tenantSlug={membership.tenantSlug}
          snapshot={opsSnapshot}
          readOnly={!canEdit}
        />
      </Card>
    </>
  );
}
