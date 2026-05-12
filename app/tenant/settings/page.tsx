import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import styles from './settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings');

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

        <Card title="Workspace" description="Read-only snapshot from your tenant record.">
          <KeyValueList
            items={[
              { key: 'Name', value: membership.tenantName },
              { key: 'Slug', value: membership.tenantSlug },
              { key: 'Your role', value: membership.role },
            ]}
          />
        </Card>
      </Stack>
    </>
  );
}
