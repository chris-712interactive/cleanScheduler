import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { PasskeySettingsPanel } from '@/components/auth/PasskeySettingsPanel';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { getPortalContext } from '@/lib/portal';
import {
  parsePreferredTimeWindow,
  parsePreferredWeekdays,
} from '@/lib/schedule/optimizer/preferences';
import { createAdminClient } from '@/lib/supabase/server';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { CustomerSchedulePreferencesForm } from './CustomerSchedulePreferencesForm';
import styles from './settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function CustomerSettingsPage() {
  const auth = await requirePortalAccess('customer', '/settings');
  const portal = await getPortalContext();
  const showPasskey = !portal.whiteLabelHostname;
  const admin = createAdminClient();
  const portalContext = await getCustomerPortalContext(auth.user.id);
  const [{ data: identity }, { data: schedulePrefs }] = await Promise.all([
    admin
      .from('customer_identities')
      .select('first_name, last_name, full_name, email, phone')
      .eq('auth_user_id', auth.user.id)
      .maybeSingle(),
    portalContext?.customerIds.length
      ? admin
          .from('tenant_customer_scheduling_preferences')
          .select('tenant_id, customer_id, preferred_weekdays, preferred_time_window')
          .in('customer_id', portalContext.customerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const links = portalContext?.links ?? [];

  let nameRow = '—';
  if (identity) {
    const n = formatCustomerDisplayName(identity);
    nameRow = n === 'Unnamed' ? '—' : n;
  }

  return (
    <>
      <PageHeader
        title="Settings"
        description="Profile details come from your customer record. Ask your provider to update anything that looks wrong."
      />

      <Stack gap={6}>
        <Card
          title="Appearance"
          description="Applies on this device and syncs when profile theme preference ships."
        >
          <div className={styles.themeRow}>
            <span className={styles.label}>Theme</span>
            <ThemeToggle />
          </div>
        </Card>

        <Card title="Contact" description="From your linked customer identity.">
          {identity ? (
            <KeyValueList
              items={[
                { key: 'Name', value: nameRow },
                { key: 'Email', value: identity.email?.trim() || '—' },
                { key: 'Phone', value: identity.phone?.trim() || '—' },
              ]}
            />
          ) : (
            <p className={styles.muted}>No customer identity is linked to this login yet.</p>
          )}
        </Card>

        <Card
          title="Visit days and times"
          description="Your cleaner uses this when building the schedule. Leave the days blank if any open day works."
        >
          {links.length === 0 ? (
            <p className={styles.muted}>Your account is not linked to a cleaning company yet.</p>
          ) : (
            links.map((link) => {
              const saved = (schedulePrefs ?? []).find(
                (row) => row.tenant_id === link.tenantId && row.customer_id === link.customerId,
              );
              return (
                <CustomerSchedulePreferencesForm
                  key={link.linkId}
                  tenantId={link.tenantId}
                  tenantName={link.tenantName}
                  customerId={link.customerId}
                  showCompanyName={links.length > 1}
                  weekdays={parsePreferredWeekdays(saved?.preferred_weekdays)}
                  timeWindow={parsePreferredTimeWindow(saved?.preferred_time_window)}
                />
              );
            })
          )}
        </Card>

        {showPasskey ? (
          <Card
            title="Passkey"
            description="Sign in next time with Face ID, a fingerprint, or this device’s PIN instead of a password."
          >
            <PasskeySettingsPanel />
          </Card>
        ) : null}

        <Card title="Account" description="End your session on this device.">
          <p className={styles.muted}>Signed in as {auth.user.email?.trim() || 'your account'}.</p>
          <SignOutButton variant="settings" />
        </Card>
      </Stack>
    </>
  );
}
