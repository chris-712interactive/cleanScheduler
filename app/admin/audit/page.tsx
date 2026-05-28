import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { createAdminClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/EmptyState';
import styles from '../tenants/tenants.module.scss';

export const dynamic = 'force-dynamic';

export default async function AdminAuditLogPage() {
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from('audit_log_entries')
    .select('id, action, actor_user_id, target_tenant_id, payload, created_at')
    .order('created_at', { ascending: false })
    .limit(200);

  return (
    <>
      <PageHeader title="Audit log" description="Security-sensitive actions across the platform." />

      {error ? (
        <Card title="Could not load entries">
          <p className={styles.empty}>{error.message}</p>
        </Card>
      ) : !rows?.length ? (
        <EmptyState
          title="No entries yet"
          description="Masquerade sessions and other actions will appear here."
        />
      ) : (
        <Stack gap={2}>
          {rows.map((row) => (
            <Card
              key={row.id}
              title={row.action}
              description={new Date(row.created_at).toLocaleString()}
            >
              <p className={styles.empty}>Actor: {row.actor_user_id ?? '—'}</p>
              <p className={styles.empty}>Tenant: {row.target_tenant_id ?? '—'}</p>
              {row.payload ? (
                <pre
                  className={styles.empty}
                  style={{ whiteSpace: 'pre-wrap', fontSize: 'var(--font-size-xs)' }}
                >
                  {JSON.stringify(row.payload, null, 2)}
                </pre>
              ) : null}
            </Card>
          ))}
        </Stack>
      )}
    </>
  );
}
