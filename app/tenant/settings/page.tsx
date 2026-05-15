import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { normalizePaymentMethodsFromDb } from '@/lib/tenant/operationalSettings';
import { OperationalSettingsForm } from './OperationalSettingsForm';
import { ProfileSettingsForm } from './ProfileSettingsForm';
import styles from './settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings');

  const supabase = createTenantPortalDbClient();
  const auth = await getAuthContext();
  const { data: myProfile } =
    auth?.user.id != null
      ? await supabase
          .from('user_profiles')
          .select('display_name, avatar_url')
          .eq('user_id', auth.user.id)
          .maybeSingle()
      : { data: null };
  const displayName =
    myProfile?.display_name?.trim() ||
    auth?.user?.email?.split('@')[0] ||
    'Team member';
  const avatarUrl = myProfile?.avatar_url ?? null;
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
        title="Settings"
        description="Personal preferences and workspace details. Deeper billing and Connect setup stay under Billing."
      />

      <Stack gap={6}>
        <Card title="Appearance" description="Light, dark, or match your system.">
          <div className={styles.themeRow}>
            <span className={styles.label}>Theme</span>
            <ThemeToggle />
          </div>
        </Card>

        <Card title="Your profile" description="Name and photo shown to teammates in this workspace.">
          <ProfileSettingsForm
            tenantSlug={membership.tenantSlug}
            displayName={displayName}
            avatarUrl={avatarUrl}
          />
        </Card>

        <Card title="Workspace" description="Read-only snapshot from your tenant record.">
          <KeyValueList
            items={[
              { key: 'Name', value: membership.tenantName },
              { key: 'Slug', value: membership.tenantSlug },
              { key: 'Your role', value: membership.role },
            ]}
          />
        </Card>

        <Card
          title="Quotes, scheduling & customer payments"
          description="Defaults for quotes, scheduling, payments, and Resend email notifications. SMS toggles are stored for a future release."
        >
          <OperationalSettingsForm tenantSlug={membership.tenantSlug} snapshot={opsSnapshot} />
        </Card>

        <Card title="Account" description="End your session on this device.">
          <p className={styles.muted}>
            Signed in as {auth?.user.email?.trim() || 'your account'}.
          </p>
          <SignOutButton variant="settings" />
        </Card>
      </Stack>
    </>
  );
}
