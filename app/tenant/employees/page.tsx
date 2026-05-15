import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { EmptyState } from '@/components/ui/EmptyState';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/session';
import {
  allowedInviteRolesForActor,
  canEditTeamMember,
  canManageTeamInvitesAndRoles,
} from '@/lib/tenant/employeePermissions';
import { isResendConfigured } from '@/lib/email/resend';
import type { TenantRole } from '@/lib/auth/types';
import { EmployeeInviteForm } from './EmployeeInviteForm';
import { TeamMemberRow } from './TeamMemberRow';
import styles from './employees.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantEmployeesPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/employees');
  const admin = createAdminClient();
  const auth = await getAuthContext();
  const currentUserId = auth?.user.id ?? '';

  const { data: rows, error } = await admin
    .from('tenant_memberships')
    .select('id, role, is_active, user_id')
    .eq('tenant_id', membership.tenantId)
    .order('role', { ascending: true });

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
  const { data: profiles } =
    userIds.length > 0
      ? await admin.from('user_profiles').select('user_id, display_name, avatar_url').in('user_id', userIds)
      : { data: [] as { user_id: string; display_name: string | null; avatar_url: string | null }[] };

  const profileByUser = new Map(
    (profiles ?? []).map((p) => [p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }]),
  );

  const actorRole = membership.role as TenantRole;
  const canManage = canManageTeamInvitesAndRoles(actorRole);
  const allowedRoles = allowedInviteRolesForActor(actorRole);
  const emailReady = isResendConfigured();

  return (
    <>
      <PageHeader
        title="Team"
        description="Invite teammates by email, set permission levels, and manage who can access this workspace."
      />

      <Stack gap={4}>
        {canManage ? (
          <Card
            title="Invite teammate"
            description="They receive a secure link to set a password and join this workspace. Invites expire after 7 days."
          >
            <EmployeeInviteForm
              tenantSlug={membership.tenantSlug}
              allowedRoles={allowedRoles}
              emailReady={emailReady}
            />
          </Card>
        ) : null}

        {error ? (
          <Card title="Could not load team">
            <p className={styles.muted}>{error.message}</p>
          </Card>
        ) : !rows?.length ? (
          <EmptyState
            title="No members yet"
            description="The workspace owner should appear here after onboarding. If this looks wrong, contact support."
          />
        ) : (
          <Card
            title="Members"
            description={`${rows.length} workspace ${rows.length === 1 ? 'member' : 'members'}.`}
          >
            <ul className={styles.list}>
              {rows.map((row) => {
                const prof = profileByUser.get(row.user_id);
                const displayName = prof?.display_name ?? '';
                const avatarUrl = prof?.avatar_url ?? null;
                const role = row.role as TenantRole;
                const isSelf = currentUserId === row.user_id;
                const canEdit =
                  canEditTeamMember({
                    actor: actorRole,
                    actorUserId: currentUserId,
                    targetUserId: row.user_id,
                    targetRole: role,
                  });
                return (
                  <TeamMemberRow
                    key={row.id}
                    memberUserId={row.user_id}
                    displayName={displayName}
                    avatarUrl={avatarUrl}
                    role={role}
                    isActive={row.is_active}
                    isSelf={isSelf}
                    canEdit={canEdit}
                  />
                );
              })}
            </ul>
          </Card>
        )}
      </Stack>
    </>
  );
}
