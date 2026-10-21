import { PageHeader } from '@/components/portal/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FeedbackToasts } from '@/components/ui/FeedbackToast';
import { createTenantPortalDbClient } from '@/lib/supabase/server';
import { getPortalContext } from '@/lib/portal';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { createTenantInvoiceAction } from '@/lib/admin/tenantInvoiceActions';
import { invoicePropertyLabel } from '@/lib/billing/invoiceProperty';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';
import { InvoiceCustomerPropertyFields } from '../InvoiceCustomerPropertyFields';
import styles from '../../billing.module.scss';

export const dynamic = 'force-dynamic';

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function NewTenantInvoicePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const defaultCustomerId = firstParam(sp.customer_id)?.trim() ?? '';
  const defaultPropertyId = firstParam(sp.property_id)?.trim() ?? '';
  const defaultQuoteId = firstParam(sp.quote_id)?.trim() ?? '';
  const defaultTitle = firstParam(sp.title)?.trim() ?? '';
  const defaultAmount = firstParam(sp.amount_dollars)?.trim() ?? '';
  const defaultNotes = firstParam(sp.notes)?.trim() ?? '';
  const createError = invoiceCreateErrorMessage(firstParam(sp.error));

  const { tenantSlug } = await getPortalContext();
  const membership = await requireTenantPortalAccess(tenantSlug, '/billing/invoices/new');
  const db = createTenantPortalDbClient();

  const { data: customers, error } = await db
    .from('customers')
    .select(
      `
      id,
      customer_identity_id,
      customer_identities(first_name, last_name, full_name, email),
      tenant_customer_properties (
        id,
        label,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        is_primary
      )
    `,
    )
    .eq('tenant_id', membership.tenantId)
    .eq('status', 'active')
    .order('created_at', { ascending: true });

  const customerOptions = (customers ?? []).map((customer) => {
    const idRow = customer.customer_identities as {
      first_name: string | null;
      last_name: string | null;
      full_name: string | null;
      email: string | null;
    } | null;
    const fromName = idRow ? formatCustomerDisplayName(idRow) : 'Unnamed';
    const label =
      fromName !== 'Unnamed'
        ? fromName
        : idRow?.email?.trim() || `Customer ${customer.id.slice(0, 8)}…`;
    const properties = [...(customer.tenant_customer_properties ?? [])].sort((a, b) => {
      if (a.is_primary === b.is_primary) return 0;
      return a.is_primary ? -1 : 1;
    });
    return {
      id: customer.id,
      label,
      properties: properties.map((property) => ({
        id: property.id,
        label: invoicePropertyLabel(property) || 'Property',
      })),
    };
  });

  return (
    <>
      <PageHeader
        title="New invoice"
        backHref="/billing/invoices"
        backLabel="Customer invoices"
        titleHint="Issue a balance to a customer in this workspace."
      />

      <FeedbackToasts messages={[createError ? { title: createError, variant: 'danger' } : null]} />

      {error ? (
        <Card title="Could not load customers">
          <p className={styles.muted}>{error.message}</p>
        </Card>
      ) : (
        <Card title="Invoice details">
          <form action={createTenantInvoiceAction} className={styles.invoiceCreateForm}>
            <input type="hidden" name="tenant_slug" value={membership.tenantSlug} />
            {defaultQuoteId ? <input type="hidden" name="quote_id" value={defaultQuoteId} /> : null}
            <InvoiceCustomerPropertyFields
              customers={customerOptions}
              defaultCustomerId={defaultCustomerId}
              defaultPropertyId={defaultPropertyId}
            />
            <label className={styles.field}>
              <span>Title</span>
              <input
                name="title"
                type="text"
                className={styles.input}
                placeholder="e.g. March deep clean"
                defaultValue={defaultTitle}
              />
            </label>
            <label className={styles.field}>
              <span>Amount (USD)</span>
              <input
                name="amount_dollars"
                type="text"
                className={styles.input}
                placeholder="120.00"
                required
                defaultValue={defaultAmount}
              />
            </label>
            <label className={styles.field}>
              <span>Due date (optional)</span>
              <input name="due_date" type="date" className={styles.input} />
            </label>
            <label className={`${styles.field} ${styles.invoiceCreateSpan}`}>
              <span>Notes (optional)</span>
              <textarea
                name="notes"
                className={styles.textarea}
                rows={3}
                defaultValue={defaultNotes}
              />
            </label>
            <div className={styles.invoiceCreateActions}>
              <Button type="submit" variant="primary">
                Create invoice
              </Button>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}

function invoiceCreateErrorMessage(raw: string | undefined): string | null {
  if (!raw) return null;
  switch (raw) {
    case 'invalid':
      return 'Enter a customer and an amount greater than zero.';
    case 'customer':
      return 'That customer is not in this workspace.';
    case 'property':
      return 'Choose a property that belongs to this customer.';
    case 'quote':
      return 'That quote does not belong to this customer.';
    case 'save':
      return 'Could not save the invoice.';
    default:
      return raw;
  }
}
