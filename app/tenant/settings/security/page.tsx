import { Alert } from '@/components/ui/Alert';
import { PageHeader } from '@/components/portal/PageHeader';
import { Stack } from '@/components/layout/Stack';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { loadTenantAuthPolicy } from '@/lib/auth/enforceTenantAuthPolicy';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { SecurityPolicyForm } from './SecurityPolicyForm';

export const dynamic = 'force-dynamic';

const ERRORS: Record<string, string> = {
  forbidden: 'Only an owner or admin can change sign-in policy.',
  methods: 'Choose at least one second step when two-factor authentication is required.',
  save: 'Could not save sign-in policy. Apply the latest database migration and try again.',
  invalid: 'Could not tell which workspace to update.',
};

export default async function TenantSecuritySettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/settings/security', {
    browserPathname: '/settings/security',
  });
  const policy = await loadTenantAuthPolicy(membership.tenantId);
  const canEdit = canManageTeamInvitesAndRoles(membership.role);
  const params = await searchParams;
  const errorCode = typeof params.error === 'string' ? params.error : '';
  const saved = params.saved === '1';

  return (
    <>
      <PageHeader
        title="Sign-in security"
        titleHint="Passkeys and the second steps this workspace accepts."
        backHref="/settings"
        backLabel="Settings"
      />
      <Stack gap={4}>
        {saved ? <Alert variant="success">Sign-in policy saved.</Alert> : null}
        {ERRORS[errorCode] ? <Alert>{ERRORS[errorCode]}</Alert> : null}
        <SecurityPolicyForm tenantSlug={membership.tenantSlug} policy={policy} canEdit={canEdit} />
      </Stack>
    </>
  );
}
