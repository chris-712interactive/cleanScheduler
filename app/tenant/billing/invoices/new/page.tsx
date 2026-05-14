import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createTenantInvoiceAction } from '@/lib/admin/tenantInvoiceActions';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import styles from '../../billing.module.scss';

export const dynamic = 'force-dynamic';

export default async function NewTenantInvoicePage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/invoices/new');
  const db = createTenantPortalDbClient();

  const { data: customers, error } = await db
    .from('customers')
    .select('id, customer_identity_id, customer_identities(first_name, last_name, full_name, email)')
    .eq('tenant_id', membership.tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  return (
    <>
      <PageHeader title="New invoice" description="Issue a balance to a customer in this workspace." />

      <p className={styles.backLinkWrap}>
        <Link href="/billing/invoices" className={styles.backLink}>
          ← All invoices
        </Link>
      </p>

      {error ? (
        <Card title="Could not load customers">
          <p className={styles.muted}>{error.message}</p>
        </Card>
      ) : (
        <Card title="Invoice details">
          <form action={createTenantInvoiceAction} className={styles.resumeForm}>
            <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
            <Stack gap={4} as="div">
              <label className={styles.field}>
                <span>Customer</span>
                <select name="customer_id" required className={styles.select}>
                  <option value="">Select…</option>
                  {(customers ?? []).map((c) => {
                    const idRow = c.customer_identities as {
                      first_name: string | null;
                      last_name: string | null;
                      full_name: string | null;
                      email: string | null;
                    } | null;
                    const fromName = idRow ? formatCustomerDisplayName(idRow) : 'Unnamed';
                    const label =
                      fromName !== 'Unnamed' ? fromName : idRow?.email?.trim() || `Customer ${c.id.slice(0, 8)}…`;
                    return (
                      <option key={c.id} value={c.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className={styles.field}>
                <span>Title</span>
                <input name="title" type="text" className={styles.input} placeholder="e.g. March deep clean" />
              </label>
              <label className={styles.field}>
                <span>Amount (USD)</span>
                <input name="amount_dollars" type="text" className={styles.input} placeholder="120.00" required />
              </label>
              <label className={styles.field}>
                <span>Due date (optional)</span>
                <input name="due_date" type="date" className={styles.input} />
              </label>
              <label className={styles.field}>
                <span>Notes (optional)</span>
                <textarea name="notes" className={styles.textarea} rows={3} />
              </label>
              <Button type="submit" variant="primary">
                Create invoice
              </Button>
            </Stack>
          </form>
        </Card>
      )}
    </>
  );
}
