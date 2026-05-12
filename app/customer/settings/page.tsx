import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { createAdminClient } from '@/lib/supabase/server';
import styles from './settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function CustomerSettingsPage() {
  const auth = await requirePortalAccess('customer', '/settings');
  const admin = createAdminClient();
  const { data: identity } = await admin
    .from('customer_identities')
    .select('full_name, email, phone')
    .eq('auth_user_id', auth.user.id)
    .maybeSingle();

  return (
    <>
      <PageHeader
        title="Settings"
        description="Profile details come from your customer record. Ask your provider to update anything that looks wrong."
      />

      <Stack gap={6}>
        <Card title="Appearance" description="Applies on this device and syncs when profile theme preference ships.">
          <div className={styles.themeRow}>
            <span className={styles.label}>Theme</span>
            <ThemeToggle />
          </div>
        </Card>

        <Card title="Contact" description="From your linked customer identity.">
          {identity ? (
            <KeyValueList
              items={[
                { key: 'Name', value: identity.full_name?.trim() || '—' },
                { key: 'Email', value: identity.email?.trim() || '—' },
                { key: 'Phone', value: identity.phone?.trim() || '—' },
              ]}
            />
          ) : (
            <p className={styles.muted}>No customer identity is linked to this login yet.</p>
          )}
        </Card>
      </Stack>
    </>
  );
}
