import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { createClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { CustomerCreateForm } from './CustomerCreateForm';
import styles from './customers.module.scss';

export const dynamic = 'force-dynamic';

interface CustomerListRow {
  id: string;
  status: string;
  created_at: string;
  customer_identities: {
    email: string | null;
    full_name: string | null;
    phone: string | null;
  } | null;
}

export default async function TenantCustomersPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/customers');

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db: any = supabase;
  const { data: rows } = await db
    .from('customers')
    .select(
      `
      id,
      status,
      created_at,
      customer_identities (
        email,
        full_name,
        phone
      )
    `,
    )
    .eq('tenant_id', membership.tenantId)
    .order('created_at', { ascending: false });

  const customers = (rows ?? []) as CustomerListRow[];

  return (
    <>
      <PageHeader
        title="Customers"
        description="Residential and commercial accounts you serve under this workspace."
      />

      <Stack gap={6}>
        <Card title="Add customer" description="Creates a customer profile for this business only.">
          <CustomerCreateForm tenantSlug={membership.tenantSlug} />
        </Card>

        <Card title="Directory" description={`${customers.length} customer${customers.length === 1 ? '' : 's'}`}>
          {customers.length === 0 ? (
            <p className={styles.empty}>No customers yet.</p>
          ) : (
            <ul className={styles.list}>
              {customers.map((c) => {
                const id = c.customer_identities;
                const name = id?.full_name ?? 'Unnamed';
                const email = id?.email ?? '—';
                const phone = id?.phone ?? '—';
                return (
                  <li key={c.id} className={styles.row}>
                    <div>
                      <div className={styles.name}>{name}</div>
                      <div className={styles.sub}>
                        {email} · {phone}
                      </div>
                    </div>
                    <span className={styles.status}>{c.status}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </Stack>
    </>
  );
}
