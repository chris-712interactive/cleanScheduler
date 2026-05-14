import Link from 'next/link';
import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { formatUsdFromCents } from '@/lib/format/money';
import styles from '../billing.module.scss';

export const dynamic = 'force-dynamic';

export default async function TenantCustomerInvoicesPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/invoices');
  const db = createTenantPortalDbClient();

  const { data: invoices, error } = await db
    .from('tenant_invoices')
    .select('id, title, status, amount_cents, amount_paid_cents, due_date, created_at')
    .eq('tenant_id', membership.tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeader
        title="Customer invoices"
        description="Bill your customers for completed work. Payments update balances automatically."
        actions={
          <Button variant="primary" as="a" href="/billing/invoices/new">
            New invoice
          </Button>
        }
      />

      <p className={styles.backLinkWrap}>
        <Link href="/billing" className={styles.backLink}>
          ← Workspace billing
        </Link>
      </p>

      {error ? (
        <Card title="Could not load invoices">
          <p className={styles.muted}>{error.message}</p>
        </Card>
      ) : !invoices?.length ? (
        <EmptyState
          title="No customer invoices yet"
          description="Create an invoice linked to a customer in your directory. Card checkout via Stripe Connect comes later."
          action={
            <Button variant="primary" as="a" href="/billing/invoices/new">
              Create invoice
            </Button>
          }
        />
      ) : (
        <Stack gap={3}>
          {invoices.map((inv) => (
            <Card
              key={inv.id}
              title={inv.title}
              description={`Created ${new Date(inv.created_at).toLocaleString()}`}
            >
              <div className={styles.invoiceRow}>
                <div>
                  <strong>{formatUsdFromCents(inv.amount_cents)}</strong>
                  <span className={styles.muted}>
                    {' '}
                    · paid {formatUsdFromCents(inv.amount_paid_cents)}
                  </span>
                </div>
                <StatusPill
                  tone={
                    inv.status === 'paid' ? 'brand' : inv.status === 'void' ? 'neutral' : 'warning'
                  }
                >
                  {inv.status}
                </StatusPill>
                <Button variant="secondary" size="sm" as="a" href={`/billing/invoices/${inv.id}`}>
                  Open
                </Button>
              </div>
            </Card>
          ))}
        </Stack>
      )}
    </>
  );
}
