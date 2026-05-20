import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { TENANT_ROLE_DEFINITIONS } from '@/lib/tenant/tenantRoleDefinitions';
import styles from '../settings.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantRolesSettingsPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/roles');
  const canManageTeam = canManageTeamInvitesAndRoles(membership.role);

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

      <div className={styles.rolesGrid}>
        {TENANT_ROLE_DEFINITIONS.map((role) => (
          <article key={role.role} className={styles.roleCard}>
            <header className={styles.roleCardHeader}>
              <h2 className={styles.roleCardTitle}>{role.label}</h2>
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

      <p className={styles.rolesFootnote}>
        Custom roles are planned for a future release. For now, assign these built-in roles when
        inviting or editing team members on the{' '}
        <Link href="/employees" className={styles.inlineLink}>
          Team
        </Link>{' '}
        page.
      </p>
    </>
  );
}
