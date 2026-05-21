import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { KeyValueList } from '@/components/ui/KeyValueList';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { getTenantPurgeStatus } from '@/lib/billing/tenantPurge';
import { teamRoleLabel } from '@/lib/tenant/teamMemberDisplay';
import type { TenantRole } from '@/lib/auth/types';
import { ProfileSettingsForm } from '../ProfileSettingsForm';
import { DeleteWorkspacePanel } from '../DeleteWorkspacePanel';
import styles from '../settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantAccountSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/account', {
    browserPathname: '/settings/account',
    internalPathname: '/tenant/settings/account',
  });

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
  const isOwner = membership.role === 'owner';

  const admin = createAdminClient();
  const { data: billing } = await admin
    .from('tenant_billing_accounts')
    .select('activated_at, trial_ends_at, stripe_subscription_id, stripe_customer_id')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  const purgeStatus = getTenantPurgeStatus(billing);

  return (
    <>
      <PageHeader
        title="Account"
        titleHint="Personal profile and preferences for your login."
        backHref="/settings"
        backLabel="Settings"
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
              { key: 'Your role', value: teamRoleLabel(membership.role as TenantRole) },
            ]}
          />
          <p className={styles.muted}>
            Billing and Stripe Connect are managed under{' '}
            <Link href="/billing" className={styles.inlineLink}>
              Billing
            </Link>
            .
          </p>
        </Card>

        <Card title="Sign out" description="End your session on this device.">
          <p className={styles.muted}>
            Signed in as {auth?.user.email?.trim() || 'your account'}.
          </p>
          <SignOutButton variant="settings" />
        </Card>

        {isOwner ? (
          <Card
            title="Delete workspace"
            description="Permanently remove this workspace and all tenant data."
            className={styles.dangerCard}
          >
            <DeleteWorkspacePanel tenantSlug={membership.tenantSlug} purgeStatus={purgeStatus} />
          </Card>
        ) : null}
      </Stack>
    </>
  );
}
