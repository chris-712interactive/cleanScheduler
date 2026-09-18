import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { MfaSettingsPanel } from '@/components/auth/MfaSettingsPanel';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { isPlatformAdminRole } from '@/lib/auth/platformRoles';
import { invitePlatformSalesUserAction } from '@/lib/admin/salesActions';
import { getAuthContext } from '@/lib/auth/session';
import styles from './settings.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AdminSettingsPage({ searchParams }: PageProps) {
  const auth = await requirePortalAccess('admin', '/settings');
  const current = await getAuthContext();
  const email = current?.user.email?.trim() || '—';
  const sp = await searchParams;
  const err = typeof sp.error === 'string' ? sp.error : undefined;
  const notice = typeof sp.notice === 'string' ? sp.notice : undefined;
  const canInvite = isPlatformAdminRole(auth.claims.appRole);

  return (
    <>
      <PageHeader title="Settings" description="Account preferences and session controls." />

      <Stack gap={6}>
        {err ? <Alert variant="danger">{err}</Alert> : null}
        {notice ? <Alert variant="success">{notice}</Alert> : null}
        <Card title="Appearance" description="Light, dark, or match your system.">
          <div className={styles.themeRow}>
            <span className={styles.label}>Theme</span>
            <ThemeToggle />
          </div>
        </Card>

        <Card title="Account" description="Signed-in platform user.">
          <p className={styles.muted}>{email}</p>
          <SignOutButton variant="settings" />
        </Card>

        <Card title="Two-factor authentication" description="Required for admin and sales access.">
          <MfaSettingsPanel />
        </Card>

        {canInvite ? (
          <Card
            title="Invite sales"
            description="Creates a sales closer account. They can use Outreach and Pipeline only — not fraud, tenants, or accounting."
          >
            <form action={invitePlatformSalesUserAction}>
              <FormField label="Name" htmlFor="displayName" optional>
                <Input id="displayName" name="displayName" placeholder="Alex" />
              </FormField>
              <FormField label="Email" htmlFor="email">
                <Input id="email" name="email" type="email" required />
              </FormField>
              <Button type="submit" variant="primary">
                Send invite
              </Button>
            </form>
          </Card>
        ) : null}
      </Stack>
    </>
  );
}
