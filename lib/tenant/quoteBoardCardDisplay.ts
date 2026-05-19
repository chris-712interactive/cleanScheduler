import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import { formatPropertyAddressLine } from '@/lib/tenant/formatPropertyAddress';
import type { QuoteListEmbedRow } from '@/lib/tenant/quoteEmbedTypes';

export type QuoteBoardCardDisplay = {
  headline: string;
  serviceLine: string;
  dateLabel: string;
};

export function getQuoteBoardCardDisplay(quote: QuoteListEmbedRow): QuoteBoardCardDisplay {
  const ident = quote.customers?.customer_identities;
  const customerName =
    ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : '';
  const prop = quote.tenant_customer_properties;
  const propertyLabel = prop?.label?.trim() || '';
  const site = prop ? formatPropertyAddressLine(prop) : '';

  const headline =
    propertyLabel ||
    customerName ||
    (quote.customer_id ? 'Linked customer' : quote.title);

  const serviceLine =
    propertyLabel && quote.title !== headline
      ? quote.title
      : site || (customerName && quote.title !== customerName ? quote.title : '');

  const dateLabel = new Date(quote.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return { headline, serviceLine, dateLabel };
}
