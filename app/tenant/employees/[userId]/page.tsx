import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/server';
import type { TenantRole } from '@/lib/auth/types';
import {
  canChangeMemberRole,
  canEditTeamMember,
  canToggleMemberActive,
  roleOptionsForMemberEditor,
} from '@/lib/tenant/employeePermissions';
import { EmployeeMemberEditForm } from '../EmployeeMemberEditForm';
import styles from '../employeeEdit.module.scss';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function TenantEmployeeEditPage({ params }: PageProps) {
  const { userId: rawUserId } = await params;
  const targetUserId = rawUserId.trim();
  if (!UUID_RE.test(targetUserId)) {
    notFound();
  }

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, `/employees/${targetUserId}`);
  const auth = await getAuthContext();
  if (!auth) {
    redirect('/sign-in');
  }

  if (auth.user.id === targetUserId) {
    redirect('/settings');
  }

  const admin = createAdminClient();
  const { data: memberRow, error: memberErr } = await admin
    .from('tenant_memberships')
    .select('role, is_active')
    .eq('tenant_id', membership.tenantId)
    .eq('user_id', targetUserId)
    .maybeSingle();

  if (memberErr || !memberRow) {
    notFound();
  }

  const targetRole = memberRow.role as TenantRole;
  const actorRole = membership.role as TenantRole;

  if (
    !canEditTeamMember({
      actor: actorRole,
      actorUserId: auth.user.id,
      targetUserId,
      targetRole,
    })
  ) {
    redirect('/employees');
  }

  const { data: profile } = await admin
    .from('user_profiles')
    .select('display_name, avatar_url')
    .eq('user_id', targetUserId)
    .maybeSingle();

  const { data: authUser } = await admin.auth.admin.getUserById(targetUserId);
  const email = authUser?.user?.email ?? null;
  const displayName = profile?.display_name?.trim() || email?.split('@')[0] || 'Team member';

  const roleOptions = roleOptionsForMemberEditor(actorRole);
  const canChangeRole =
    targetRole !== 'owner' &&
    roleOptions.length > 0 &&
    roleOptions.some((o) =>
      canChangeMemberRole({
        actor: actorRole,
        actorUserId: auth.user.id,
        targetUserId,
        targetCurrentRole: targetRole,
        nextRole: o.value,
      }),
    );
  const canToggleActive = canToggleMemberActive({
    actor: actorRole,
    actorUserId: auth.user.id,
    targetUserId,
    targetRole,
  });

  return (
    <>
      <p className={styles.backWrap}>
        <Link href="/employees" className={styles.backLink}>
          ← Back to team
        </Link>
      </p>
      <PageHeader
        title={displayName}
        description="Manage profile, photo, and workspace access for this teammate."
      />
      <Card title="Member details">
        <EmployeeMemberEditForm
          tenantSlug={membership.tenantSlug}
          targetUserId={targetUserId}
          displayName={displayName}
          avatarUrl={profile?.avatar_url ?? null}
          email={email}
          role={targetRole}
          isActive={memberRow.is_active}
          roleOptions={roleOptions}
          canChangeRole={canChangeRole}
          canToggleActive={canToggleActive}
        />
      </Card>
    </>
  );
}
