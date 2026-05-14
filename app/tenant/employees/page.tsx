import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createAdminClient } from '@/lib/supabase/server';
import styles from './employees.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantEmployeesPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/employees');
  const admin = createAdminClient();

  const { data: rows, error } = await admin
    .from('tenant_memberships')
    .select('id, role, is_active, user_id')
    .eq('tenant_id', membership.tenantId)
    .order('role', { ascending: true });

  const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
  const { data: profiles } =
    userIds.length > 0
      ? await admin.from('user_profiles').select('user_id, display_name').in('user_id', userIds)
      : { data: [] as { user_id: string; display_name: string | null }[] };

  const nameByUser = new Map((profiles ?? []).map((p) => [p.user_id, p.display_name]));

  return (
    <>
      <PageHeader
        title="Team"
        description="People who can sign in to this workspace. Invites and role editing ship next."
      />

      <Stack gap={4}>
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
            description={`${rows.length} workspace ${rows.length === 1 ? 'member' : 'members'}`}
          >
            <ul className={styles.list}>
              {rows.map((row) => {
                const label =
                  nameByUser.get(row.user_id)?.trim() || `User ${row.user_id.slice(0, 8)}…`;
                return (
                  <li key={row.id} className={styles.row} title={`User id: ${row.user_id}`}>
                    <div>
                      <div className={styles.name}>{label}</div>
                    </div>
                    <div className={styles.badges}>
                      <StatusPill tone={row.is_active ? 'brand' : 'neutral'}>{row.role}</StatusPill>
                      {!row.is_active ? <StatusPill tone="warning">Inactive</StatusPill> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </Stack>
    </>
  );
}
