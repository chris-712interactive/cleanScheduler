import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  allowedInviteRolesForActor,
  canManageTeamInvitesAndRoles,
} from '@/lib/tenant/employeePermissions';
import { isResendConfigured } from '@/lib/email/resend';
import type { TenantRole } from '@/lib/auth/types';
import { EmployeeInviteForm } from '../EmployeeInviteForm';
import styles from '../employees.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantEmployeeInvitePage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/employees/new');

  if (!canManageTeamInvitesAndRoles(membership.role as TenantRole)) {
    redirect('/employees');
  }

  const allowedRoles = allowedInviteRolesForActor(membership.role as TenantRole);
  const emailReady = isResendConfigured();

  return (
    <>
      <PageHeader
        title="Add employee"
        description="Send a secure invite by email. They set a password and join this workspace. Invites expire after 7 days."
        breadcrumbs={[{ label: 'Team', href: '/employees' }, { label: 'Add employee' }]}
        actions={
          <Link href="/employees" className={styles.backLink}>
            ← Back to team
          </Link>
        }
      />

      <Stack gap={6}>
        <Card title="Invite details" description="Work email and permission level for this teammate.">
          <EmployeeInviteForm
            tenantSlug={membership.tenantSlug}
            allowedRoles={allowedRoles}
            emailReady={emailReady}
          />
        </Card>
      </Stack>
    </>
  );
}
