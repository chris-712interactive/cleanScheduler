import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { StatusPill } from '@/components/ui/StatusPill';
import { EmptyState } from '@/components/ui/EmptyState';
import { requirePortalAccess } from '@/lib/auth/portalAccess';
import { getCustomerPortalContext } from '@/lib/customer/customerContext';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatUsdFromCents } from '@/lib/format/money';
import styles from './invoices.module.scss';

export const dynamic = 'force-dynamic';

type CustomerInvoiceRow = {
  id: string;
  title: string;
  status: string;
  amount_cents: number;
  amount_paid_cents: number;
  due_date: string | null;
  created_at: string;
  tenants: { name: string } | null;
};

export default async function CustomerInvoicesPage() {
  const auth = await requirePortalAccess('customer', '/invoices');
  const ctx = await getCustomerPortalContext(auth.user.id);
  if (!ctx) redirect('/access-denied?reason=no_customer_profile');

  const supabase = await createClient();
  const { data: invoices, error } =
    ctx.customerIds.length > 0
      ? await supabase
          .from('tenant_invoices')
          .select(
            `
            id,
            title,
            status,
            amount_cents,
            amount_paid_cents,
            due_date,
            created_at,
            tenants:tenants!inner ( name )
          `,
          )
          .in('customer_id', ctx.customerIds)
          .order('created_at', { ascending: false })
      : { data: [] as CustomerInvoiceRow[], error: null };

  const list = (invoices ?? []) as CustomerInvoiceRow[];

  return (
    <>
      <PageHeader
        title="Invoices"
        description="Every invoice your connected providers have issued to you."
      />

      {error ? (
        <Card title="Could not load invoices">
          <p className={styles.muted}>{error.message}</p>
        </Card>
      ) : !list.length ? (
        <EmptyState
          title="No invoices yet"
          description="When a provider sends you an invoice through cleanScheduler, it will appear here with balance and status."
        />
      ) : (
        <Stack gap={3}>
          {list.map((row) => {
            const t = row.tenants as { name: string } | null;
            const balance = Math.max(0, row.amount_cents - row.amount_paid_cents);
            return (
              <Card
                key={row.id}
                title={
                  <Link href={`/invoices/${row.id}`} className={styles.cardTitleLink}>
                    {row.title}
                  </Link>
                }
                description={t?.name ?? 'Provider'}
              >
                <div className={styles.row}>
                  <StatusPill tone={row.status === 'paid' ? 'brand' : balance > 0 ? 'warning' : 'neutral'}>
                    {row.status}
                  </StatusPill>
                  <span>
                    <strong>{formatUsdFromCents(row.amount_cents)}</strong>
                    <span className={styles.muted}>
                      {' '}
                      · balance {formatUsdFromCents(balance)}
                    </span>
                  </span>
                </div>
                <p className={styles.meta}>
                  Issued {new Date(row.created_at).toLocaleDateString()}
                  {row.due_date ? ` · Due ${new Date(String(row.due_date)).toLocaleDateString()}` : ''}
                </p>
              </Card>
            );
          })}
        </Stack>
      )}
    </>
  );
}
