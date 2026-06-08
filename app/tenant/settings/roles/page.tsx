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
import { loadTenantRoles } from '@/lib/tenant/loadTenantRoles';
import {
  hasPermission,
  resolveMembershipPermissions,
} from '@/lib/tenant/resolveMembershipPermissions';
import { TENANT_ROLE_DEFINITIONS } from '@/lib/tenant/tenantRoleDefinitions';
import { TenantRolesSettingsPanel } from './TenantRolesSettingsPanel';
import styles from './roles-settings.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function TenantRolesSettingsPage({ searchParams }: PageProps) {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/roles');
  const admin = createAdminClient();
  const tier = await resolveTenantPlanTier(admin, membership.tenantId);
  const rolePermissionsEnabled = isFeatureEnabled(tier, 'rolePermissions');
  const permissions = await resolveMembershipPermissions(admin, membership);
  const canManageRoles = hasPermission(permissions, 'team.manage_roles');
  const canManageTeam = hasPermission(permissions, 'team.invite');
  const roles = rolePermissionsEnabled ? await loadTenantRoles(admin, membership.tenantId) : [];

  const sp = await searchParams;
  const saved = firstParam(sp.saved) === '1';
  const deleted = firstParam(sp.deleted) === '1';
  const errorCode = firstParam(sp.error) ?? null;

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        titleHint="Control who can view or change each part of your workspace."
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
          <TenantRolesSettingsPanel
            tenantSlug={tenantSlug ?? ''}
            roles={roles}
            canManageRoles={canManageRoles}
            saved={saved}
            deleted={deleted}
            errorCode={errorCode}
          />
        )}

        {rolePermissionsEnabled ? (
          <p className={styles.footnote}>
            Assign roles when inviting or editing team members on the{' '}
            <Link href="/employees" className={styles.inlineLink}>
              Team
            </Link>{' '}
            page. Custom roles use their base template for seat counting (office vs field).
          </p>
        ) : null}
      </Stack>
    </>
  );
}
