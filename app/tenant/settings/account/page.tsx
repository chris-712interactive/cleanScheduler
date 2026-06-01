import Link from 'next/link';
import Image from 'next/image';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { SignOutButton } from '@/components/auth/SignOutButton';
import { MfaSettingsPanel } from '@/components/auth/MfaSettingsPanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient, createTenantPortalDbClient } from '@/lib/supabase/server';
import { getTenantPurgeStatus } from '@/lib/billing/tenantPurge';
import { isFieldEmployeeRole } from '@/lib/tenant/fieldEmployeeAccess';
import { teamRoleLabel } from '@/lib/tenant/teamMemberDisplay';
import type { TenantRole } from '@/lib/auth/types';
import { hasMinimumTenantRole } from '@/lib/auth/tenantRoleAccess';
import { syncedFullNameFromParts } from '@/lib/people/personName';
import { AccountPreferencesPanel } from './AccountPreferencesPanel';
import { AccountDeleteWorkspacePanel } from './AccountDeleteWorkspacePanel';
import styles from './account-settings.module.scss';

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
          .select('display_name, first_name, last_name, avatar_url')
          .eq('user_id', auth.user.id)
          .maybeSingle()
      : { data: null };
  const firstName =
    myProfile?.first_name?.trim() ||
    myProfile?.display_name?.trim().split(/\s+/)[0] ||
    auth?.user?.email?.split('@')[0] ||
    '';
  const lastName = myProfile?.last_name?.trim() || '';
  const displayName =
    syncedFullNameFromParts(firstName, lastName) ||
    myProfile?.display_name?.trim() ||
    auth?.user?.email?.split('@')[0] ||
    'Team member';
  const avatarUrl = myProfile?.avatar_url ?? null;
  const email = auth?.user.email?.trim() || '';
  const isOwner = membership.role === 'owner';
  const isFieldEmployee = isFieldEmployeeRole(membership.role);
  const requiresMfaForPlaid = hasMinimumTenantRole(membership.role, 'admin');

  const admin = createAdminClient();
  const { data: billing } = await admin
    .from('tenant_billing_accounts')
    .select('activated_at, trial_ends_at, stripe_subscription_id, stripe_customer_id')
    .eq('tenant_id', membership.tenantId)
    .maybeSingle();
  const purgeStatus = getTenantPurgeStatus(billing);

  const navItems = [
    { href: '#account-profile', label: 'Profile' },
    ...(requiresMfaForPlaid ? [{ href: '#account-security', label: 'Security' }] : []),
    { href: '#account-workspace', label: 'Workspace' },
    { href: '#account-session', label: 'Session' },
    ...(isOwner ? [{ href: '#account-danger', label: 'Delete' }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Account"
        titleHint="Your profile, sign-in security, and workspace snapshot."
        backHref="/settings"
        backLabel="Settings"
      />

      <Stack gap={5}>
        <div className={styles.identityHero}>
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt=""
              width={64}
              height={64}
              className={styles.identityAvatar}
            />
          ) : (
            <div className={styles.identityAvatarPlaceholder} aria-hidden>
              {(displayName.trim().slice(0, 2) || 'Me').toUpperCase()}
            </div>
          )}
          <div className={styles.identityCopy}>
            <h2 className={styles.identityName}>{displayName}</h2>
            {email ? <p className={styles.identityEmail}>{email}</p> : null}
            <div className={styles.identityMeta}>
              <span className={styles.metaChip}>
                {teamRoleLabel(membership.role as TenantRole)}
              </span>
              <span className={styles.metaChip}>{membership.tenantName}</span>
            </div>
          </div>
        </div>

        <nav className={styles.sectionNav} aria-label="Account sections">
          {navItems.map((item) => (
            <a key={item.href} className={styles.sectionNavLink} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className={styles.accountStack}>
          <AccountPreferencesPanel
            tenantSlug={membership.tenantSlug}
            firstName={firstName}
            lastName={lastName}
            avatarUrl={avatarUrl}
            initials={(displayName.trim().slice(0, 2) || 'Me').toUpperCase()}
          />

          {requiresMfaForPlaid ? (
            <section id="account-security" className={styles.settingsSection} aria-label="Security">
              <MfaSettingsPanel requiredForPlaid />
            </section>
          ) : null}

          <section
            id="account-workspace"
            className={styles.settingsSection}
            aria-labelledby="workspace-heading"
          >
            <header className={styles.sectionHeader}>
              <h2 id="workspace-heading" className={styles.sectionTitle}>
                Workspace
              </h2>
              <p className={styles.sectionLead}>
                Read-only details for the workspace you are signed into.
              </p>
            </header>
            <div className={styles.infoGrid}>
              <div className={styles.infoTile}>
                <span className={styles.infoLabel}>Name</span>
                <span className={styles.infoValue}>{membership.tenantName}</span>
              </div>
              <div className={styles.infoTile}>
                <span className={styles.infoLabel}>Address slug</span>
                <span className={styles.infoValue}>{membership.tenantSlug}</span>
              </div>
              <div className={styles.infoTile}>
                <span className={styles.infoLabel}>Your role</span>
                <span className={styles.infoValue}>
                  {teamRoleLabel(membership.role as TenantRole)}
                </span>
              </div>
            </div>
            {!isFieldEmployee ? (
              <p className={styles.sectionLead}>
                Billing and card payments are under{' '}
                <Link href="/billing" className={styles.inlineLink}>
                  Billing
                </Link>
                .
              </p>
            ) : null}
          </section>

          <section
            id="account-session"
            className={styles.settingsSection}
            aria-labelledby="session-heading"
          >
            <header className={styles.sectionHeader}>
              <h2 id="session-heading" className={styles.sectionTitle}>
                Session
              </h2>
            </header>
            <div className={styles.sessionRow}>
              <p className={styles.sessionCopy}>
                Signed in as <strong>{email || 'your account'}</strong>
              </p>
              <SignOutButton variant="settings" />
            </div>
          </section>

          {isOwner ? (
            <AccountDeleteWorkspacePanel
              tenantSlug={membership.tenantSlug}
              purgeStatus={purgeStatus}
            />
          ) : null}
        </div>
      </Stack>
    </>
  );
}
