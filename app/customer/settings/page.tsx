import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import styles from './settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function CustomerSettingsPage() {
  const auth = await requirePortalAccess('customer', '/settings');
  const admin = createAdminClient();
  const { data: identity } = await admin
    .from('customer_identities')
    .select('first_name, last_name, full_name, email, phone')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();

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

        <Card title="Account" description="End your session on this device.">
          <p className={styles.muted}>
            Signed in as {auth.user.email?.trim() || 'your account'}.
          </p>
          <SignOutButton variant="settings" />
        </Card>
      </Stack>
    </>
  );
}
