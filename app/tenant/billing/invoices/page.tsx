import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatusPill } from '@/components/ui/StatusPill';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import {
  formatInvoiceListDate,
  formatInvoiceListHeading,
  invoiceListStatusLabel,
  invoiceListStatusTone,
} from '@/lib/billing/invoiceListDisplay';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { formatUsdFromCents } from '@/lib/format/money';
import styles from './invoices.module.scss';

export const dynamic = 'force-dynamic';

type InvoiceRow = {
  id: string;
  title: string;
  status: string;
  amount_cents: number;
  created_at: string;
  customers: {
    customer_identities: {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
    } | null;
  } | null;
};

function customerLabelFromRow(row: InvoiceRow): string {
  const ident = row.customers?.customer_identities;
  if (!ident || !customerHasAnyNameParts(ident)) return '—';
  const name = formatCustomerDisplayName(ident);
  return name === 'Unnamed' ? '—' : name;
}

export default async function TenantCustomerInvoicesPage() {
  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/invoices');
  const db = createTenantPortalDbClient();

  const { data: invoices, error } = await db
    .from('tenant_invoices')
    .select(
      `
      id,
      title,
      status,
      amount_cents,
      created_at,
      customers (
        customer_identities (
          first_name,
          last_name,
          full_name
        )
      )
    `,
    )
    .eq('tenant_id', membership.tenantId)
    .order('created_at', { ascending: false })
    .limit(100);

  const rows = (invoices ?? []) as InvoiceRow[];

  return (
    <>
      <PageHeader
        title="Customer invoices"
        backHref="/billing"
        backLabel="Workspace billing"
        titleHint="Bill your customers for completed work. Payments update balances automatically."
        actions={
          <Button variant="primary" as="a" href="/billing/invoices/new">
            New invoice
          </Button>
        }
      />

      {error ? (
        <div className={styles.errorPanel}>
          <p className={styles.muted}>{error.message}</p>
        </div>
      ) : !rows.length ? (
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
        <ul className={styles.list}>
          {rows.map((inv) => (
            <li key={inv.id}>
              <Link href={`/billing/invoices/${inv.id}`} className={styles.cardLink}>
                <article className={styles.card}>
                  <div className={styles.cardLeft}>
                    <p className={styles.invoiceHeading}>
                      {formatInvoiceListHeading(inv.id, inv.title)}
                    </p>
                    <p className={styles.customerName}>{customerLabelFromRow(inv)}</p>
                    <p className={styles.invoiceDate}>{formatInvoiceListDate(inv.created_at)}</p>
                  </div>
                  <div className={styles.cardRight}>
                    <span className={styles.amount}>{formatUsdFromCents(inv.amount_cents)}</span>
                    <StatusPill tone={invoiceListStatusTone(inv.status)}>
                      {invoiceListStatusLabel(inv.status)}
                    </StatusPill>
                    <ChevronRight size={18} className={styles.chevron} aria-hidden />
                  </div>
                </article>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
