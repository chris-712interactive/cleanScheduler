import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { FeatureUpgradePanel } from '@/components/billing/FeatureUpgradePanel';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { isFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { minimumTierLabelForFeature } from '@/lib/billing/tenantFeatureGate';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { TENANT_ROLE_DEFINITIONS } from '@/lib/tenant/tenantRoleDefinitions';
import styles from './roles-settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantRolesSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/roles');
  const canManageTeam = canManageTeamInvitesAndRoles(membership.role);
  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const rolePermissionsEnabled = isFeatureEnabled(tier, 'rolePermissions');

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        titleHint="Built-in workspace roles and what each role can do."
        backHref="/settings"
        backLabel="Settings"
        actions={
          canManageTeam ? (
            <Button variant="primary" as="a" href="/employees">
              Manage team
            </Button>
          ) : undefined
        }
      />

      <Stack gap={6}>
        {!rolePermissionsEnabled ? (
          <>
            <FeatureUpgradePanel
              title="Upgrade to unlock role permissions"
              description={`${minimumTierLabelForFeature('rolePermissions')} plans let you invite admins and viewers with scoped access — not just field employees.`}
            />
            <div className={styles.lockedSection}>
              <header className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Built-in roles overview</h2>
                <p className={styles.lockedLead}>
                  Every workspace includes Owner, Admin, Field employee, and Viewer roles. Upgrade
                  to invite admins and viewers with scoped access.
                </p>
              </header>
              <div className={styles.rolesGrid}>
                {TENANT_ROLE_DEFINITIONS.map((role) => (
                  <article key={role.role} className={styles.roleCard}>
                    <header className={styles.roleCardHeader}>
                      <h3 className={styles.roleCardTitle}>{role.label}</h3>
                      <p className={styles.roleCardSummary}>{role.summary}</p>
                    </header>
                  </article>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className={styles.stack}>
            <header className={styles.hero}>
              <h2 className={styles.heroTitle}>Who can do what in your workspace</h2>
              <p className={styles.heroLead}>
                Clean Scheduler uses built-in roles to control access. When you invite someone on
                the{' '}
                <Link href="/employees" className={styles.inlineLink}>
                  Team
                </Link>{' '}
                page, you pick the role that matches their job.
              </p>
              <div className={styles.heroMeta}>
                <span className={styles.metaChip}>
                  {TENANT_ROLE_DEFINITIONS.length} built-in roles
                </span>
                <span className={styles.metaChip}>Custom roles coming later</span>
              </div>
            </header>

            <nav className={styles.sectionNav} aria-label="Role sections">
              {TENANT_ROLE_DEFINITIONS.map((role) => (
                <a key={role.role} className={styles.sectionNavLink} href={`#role-${role.role}`}>
                  {role.label}
                </a>
              ))}
            </nav>

            <div className={styles.rolesGrid}>
              {TENANT_ROLE_DEFINITIONS.map((role) => (
                <article key={role.role} id={`role-${role.role}`} className={styles.roleCard}>
                  <header className={styles.roleCardHeader}>
                    <h3 className={styles.roleCardTitle}>{role.label}</h3>
                    <p className={styles.roleCardSummary}>{role.summary}</p>
                  </header>
                  <ul className={styles.rolePermissionList}>
                    {role.permissions.map((permission) => (
                      <li key={permission}>{permission}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <p className={styles.footnote}>
              Custom roles are planned for a future release. For now, assign these built-in roles
              when inviting or editing team members on the{' '}
              <Link href="/employees" className={styles.inlineLink}>
                Team
              </Link>{' '}
              page.
            </p>
          </div>
        )}
      </Stack>
    </>
  );
}
