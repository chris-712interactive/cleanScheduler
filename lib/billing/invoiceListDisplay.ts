import type { StatusTone } from '@/components/ui/StatusPill';
import { formatInvoiceReference } from '@/lib/billing/formatInvoiceReference';

type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void';

/** Primary line on the customer invoices list (e.g. "Invoice #INV-1005"). */
export function formatInvoiceListHeading(id: string, title?: string | null): string {
  const ref = formatInvoiceReference(id, title);
  if (/^invoice\b/i.test(ref)) return ref;
  return `Invoice #${ref}`;
}

export function formatInvoiceListDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function invoiceListStatusLabel(status: InvoiceStatus | string): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'paid':
      return 'Paid';
    case 'draft':
      return 'Draft';
    case 'void':
      return 'Void';
    default:
      return status;
  }
}

export function invoiceListStatusTone(status: InvoiceStatus | string): StatusTone {
  switch (status) {
    case 'open':
      return 'danger';
    case 'paid':
      return 'success';
    case 'draft':
      return 'info';
    case 'void':
      return 'neutral';
    default:
      return 'neutral';
  }
}
