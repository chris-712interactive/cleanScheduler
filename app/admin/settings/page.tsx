import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getAuthContext } from '@/lib/auth/session';
import styles from './settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function AdminSettingsPage() {
  await requirePortalAccess('admin', '/settings');
  const auth = await getAuthContext();
  const email = auth?.user.email?.trim() || '—';

  return (
    <>
      <PageHeader
        title="Settings"
        description="Founder admin preferences and session controls."
      />

      <Stack gap={6}>
        <Card title="Appearance" description="Light, dark, or match your system.">
          <div className={styles.themeRow}>
            <span className={styles.label}>Theme</span>
            <ThemeToggle />
          </div>
        </Card>

        <Card title="Account" description="Signed-in platform administrator.">
          <p className={styles.muted}>{email}</p>
          <SignOutButton variant="settings" />
        </Card>
      </Stack>
    </>
  );
}
