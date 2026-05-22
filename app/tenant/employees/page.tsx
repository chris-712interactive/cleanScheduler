import Image from 'next/image';
import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { Plus } from 'lucide-react';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import { getAuthContext } from '@/lib/auth/session';
import { canEditTeamMember, canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import { resolveTenantEntitlements } from '@/lib/billing/entitlements';
import { countTeamSeatUsage, formatTeamSeatUsageSummary } from '@/lib/billing/teamSeats';
import type { TenantRole } from '@/lib/auth/types';
import { teamMemberStatusLabel, teamRoleLabel } from '@/lib/tenant/teamMemberDisplay';
import { parseTeamPage, TEAM_PAGE_SIZE } from '@/lib/tenant/teamListPaging';
import { TeamMemberManageMenu } from './TeamMemberManageMenu';
import { PendingInviteActions } from './PendingInviteActions';
import { TeamPagination } from './TeamPagination';
import styles from './employees.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function initialsFrom(name: string, fallbackId: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
  }
  if (parts.length === 1 && parts[0]!.length >= 2) {
    return parts[0]!.slice(0, 2).toUpperCase();
  }
  return fallbackId.slice(0, 2).toUpperCase();
}

async function fetchEmailsByUserId(
  admin: ReturnType<typeof createAdminClient>,
  userIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  await Promise.all(
    userIds.map(async (id) => {
      const { data } = await admin.auth.admin.getUserById(id);
      const email = data.user?.email?.trim();
      if (email) map.set(id, email);
    }),
  );
  return map;
}

export default async function TenantEmployeesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const currentPage = parseTeamPage(firstParam(sp.page));

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/employees');
  const admin = createAdminClient();
  const auth = await getAuthContext();
  const currentUserId = auth?.user.id ?? '';
  const actorRole = membership.role as TenantRole;
  const canManage = canManageTeamInvitesAndRoles(actorRole);

  const entitlements = canManage
    ? await resolveTenantEntitlements(admin, membership.tenantId)
    : null;
  const seatUsage = canManage ? await countTeamSeatUsage(admin, membership.tenantId) : null;

  const { data: rows, error } = await admin
    .from('tenant_memberships')
    .select('id, role, is_active, user_id')
    .eq('tenant_id', membership.tenantId)
    .order('role', { ascending: true });

  const { data: pendingInvites } = canManage
    ? await admin
        .from('employee_invites')
        .select('token, email_normalized, invited_role, expires_at, created_at')
        .eq('tenant_id', membership.tenantId)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
    : { data: [] as { token: string; email_normalized: string; invited_role: TenantRole; expires_at: string; created_at: string }[] };

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
  const { data: profiles } =
    userIds.length > 0
      ? await admin.from('user_profiles').select('user_id, display_name, avatar_url').in('user_id', userIds)
      : { data: [] as { user_id: string; display_name: string | null; avatar_url: string | null }[] };

  const profileByUser = new Map(
    (profiles ?? []).map((p) => [p.user_id, { display_name: p.display_name, avatar_url: p.avatar_url }]),
  );

  const emailsByUser = await fetchEmailsByUserId(admin, userIds);

  const members = (rows ?? [])
    .map((row) => {
      const prof = profileByUser.get(row.user_id);
      const email = emailsByUser.get(row.user_id) ?? null;
      const displayName = prof?.display_name?.trim() || email?.split('@')[0] || 'Team member';
      const role = row.role as TenantRole;
      const isSelf = currentUserId === row.user_id;

      return {
        id: row.id,
        userId: row.user_id,
        role,
        isActive: row.is_active,
        displayName,
        avatarUrl: prof?.avatar_url ?? null,
        email,
        isSelf,
        canEdit: canEditTeamMember({
          actor: actorRole,
          actorUserId: currentUserId,
          targetUserId: row.user_id,
          targetRole: role,
        }),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }));

  const totalCount = members.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / TEAM_PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const start = (safePage - 1) * TEAM_PAGE_SIZE;
  const pageMembers = members.slice(start, start + TEAM_PAGE_SIZE);

  return (
    <>
      <PageHeader
        title="Team"
        titleHint="People who can sign in to this workspace."
        actions={
          canManage ? (
            <Button
              as="a"
              href="/employees/new"
              variant="primary"
              iconLeft={<Plus size={18} aria-hidden />}
            >
              Invite member
            </Button>
          ) : undefined
        }
      />

      {canManage && entitlements && seatUsage ? (
        <p className={styles.seatUsageBanner}>
          Team seats: {formatTeamSeatUsageSummary(seatUsage, entitlements.limits)}.{' '}
          <Link href="/billing">Upgrade plan</Link>
        </p>
      ) : null}

      {error ? (
        <div className={styles.errorPanel}>
          <p className={styles.muted}>{error.message}</p>
        </div>
      ) : !totalCount ? (
        <EmptyState
          title="No members yet"
          description={
            canManage
              ? 'Invite your first teammate to get started.'
              : 'The workspace owner should appear here after onboarding. If this looks wrong, contact support.'
          }
          action={
            canManage ? (
              <Button as={Link} href="/employees/new" variant="primary">
                Invite member
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          {canManage && (pendingInvites?.length ?? 0) > 0 ? (
            <div className={styles.tablePanel} style={{ marginBottom: 'var(--space-6)' }}>
              <div className={styles.pendingHeader}>
                <h2 className={styles.pendingTitle}>Pending invites</h2>
                <p className={styles.muted}>Invites expire after 7 days if not accepted.</p>
              </div>
              <div className={styles.tableWrap}>
                <table className={styles.teamTable}>
                  <thead>
                    <tr>
                      <th scope="col">Email</th>
                      <th scope="col">Role</th>
                      <th scope="col">Expires</th>
                      <th scope="col">
                        <span className={styles.manageHeader}>Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(pendingInvites ?? []).map((invite) => (
                      <tr key={invite.token}>
                        <td>{invite.email_normalized}</td>
                        <td>{teamRoleLabel(invite.invited_role)}</td>
                        <td>{new Date(invite.expires_at).toLocaleDateString()}</td>
                        <td className={styles.manageCell}>
                          <PendingInviteActions
                            tenantSlug={membership.tenantSlug}
                            token={invite.token}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          <div className={styles.tablePanel}>
          <div className={styles.tableWrap}>
            <table className={styles.teamTable}>
              <colgroup>
                <col className={styles.colName} />
                <col className={styles.colRole} />
                <col className={styles.colStatus} />
                <col className={styles.colManage} />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Role</th>
                  <th scope="col">Status</th>
                  <th scope="col">
                    <span className={styles.manageHeader}>Manage</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageMembers.map((member) => (
                  <tr
                    key={member.id}
                    className={member.canEdit ? styles.clickableRow : undefined}
                  >
                    <td>
                      <div className={styles.nameCell}>
                        <div className={styles.avatar}>
                          {member.avatarUrl ? (
                            <Image
                              src={member.avatarUrl}
                              alt=""
                              width={40}
                              height={40}
                              className={styles.avatarImg}
                            />
                          ) : (
                            <span className={styles.avatarFallback} aria-hidden>
                              {initialsFrom(member.displayName, member.userId)}
                            </span>
                          )}
                        </div>
                        <div className={styles.nameCopy}>
                          {member.canEdit ? (
                            <Link href={`/employees/${member.userId}`} className={styles.memberNameLink}>
                              <p className={styles.memberName}>
                                {member.displayName}
                                {member.isSelf ? <span className={styles.youBadge}>You</span> : null}
                              </p>
                            </Link>
                          ) : (
                            <p className={styles.memberName}>
                              {member.displayName}
                              {member.isSelf ? <span className={styles.youBadge}>You</span> : null}
                            </p>
                          )}
                          {member.email ? (
                            <p className={styles.memberEmail}>{member.email}</p>
                          ) : (
                            <p className={styles.memberEmailMuted}>No email on file</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={styles.roleText}>{teamRoleLabel(member.role)}</span>
                    </td>
                    <td>
                      <StatusPill
                        tone={member.isActive ? 'success' : 'warning'}
                        icon={<span className={styles.statusDot} aria-hidden />}
                      >
                        {teamMemberStatusLabel(member.isActive)}
                      </StatusPill>
                    </td>
                    <td className={styles.manageCell}>
                      <TeamMemberManageMenu
                        memberUserId={member.userId}
                        canEdit={member.canEdit}
                        isSelf={member.isSelf}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TeamPagination
            currentPage={safePage}
            totalPages={totalPages}
            totalCount={totalCount}
            fromIndex={start + 1}
            toIndex={start + pageMembers.length}
          />
        </div>
        </>
      )}
    </>
  );
}
