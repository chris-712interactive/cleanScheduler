import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { formatInvoiceReference } from '@/lib/billing/formatInvoiceReference';
import {
  customerHasAnyNameParts,
  formatCustomerDisplayName,
} from '@/lib/tenant/customerIdentityName';
import type { RelatedRecordsSnapshot } from '@/lib/tenant/relatedRecordsTypes';

export async function getInvoiceRelatedRecords(
  db: SupabaseClient<Database>,
  tenantId: string,
  invoice: { id: string; customer_id: string | null; visit_id: string | null },
): Promise<RelatedRecordsSnapshot> {
  const links: RelatedRecordsSnapshot['links'] = [];

  if (invoice.customer_id) {
    const { data: customer } = await db
      .from('customers')
      .select('id, customer_identities ( first_name, last_name, full_name )')
      .eq('tenant_id', tenantId)
      .eq('id', invoice.customer_id)
      .maybeSingle();

    const ident = customer?.customer_identities;
    const name =
      ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : 'Customer';
    links.push({
      label: 'Customer',
      detail: name === 'Unnamed' ? undefined : name,
      href: `/customers/${invoice.customer_id}`,
    });
  }

  if (invoice.visit_id) {
    const { data: visit } = await db
      .from('tenant_scheduled_visits')
      .select('id, title, starts_at, quote_id')
      .eq('tenant_id', tenantId)
      .eq('id', invoice.visit_id)
      .maybeSingle();

    if (visit) {
      links.push({
        label: 'Scheduled visit',
        detail: visit.title,
        href: `/schedule/${visit.id}`,
      });

      if (visit.quote_id) {
        const { data: quote } = await db
          .from('tenant_quotes')
          .select('id, title')
          .eq('tenant_id', tenantId)
          .eq('id', visit.quote_id)
          .maybeSingle();
        if (quote) {
          links.push({
            label: 'Quote',
            detail: quote.title,
            href: `/quotes/${quote.id}`,
          });
        }
      }
    }
  }

  links.push({
    label: 'Payment audits',
    detail: 'Track offline receipt and deposit',
    href: '/billing/payment-audits',
  });

  return { links };
}

export async function getVisitRelatedRecords(
  db: SupabaseClient<Database>,
  tenantId: string,
  visit: {
    id: string;
    customer_id: string;
    quote_id: string | null;
    completion_invoice_id: string | null;
  },
): Promise<RelatedRecordsSnapshot> {
  const links: RelatedRecordsSnapshot['links'] = [];

  const { data: customer } = await db
    .from('customers')
    .select('id, customer_identities ( first_name, last_name, full_name )')
    .eq('tenant_id', tenantId)
    .eq('id', visit.customer_id)
    .maybeSingle();

  const ident = customer?.customer_identities;
  const name =
    ident && customerHasAnyNameParts(ident) ? formatCustomerDisplayName(ident) : 'Customer';
  links.push({
    label: 'Customer',
    detail: name === 'Unnamed' ? undefined : name,
    href: `/customers/${visit.customer_id}`,
  });

  if (visit.quote_id) {
    const { data: quote } = await db
      .from('tenant_quotes')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .eq('id', visit.quote_id)
      .maybeSingle();
    if (quote) {
      links.push({
        label: 'Quote',
        detail: quote.title,
        href: `/quotes/${quote.id}`,
      });
    }
  }

  const invoiceId = visit.completion_invoice_id;
  if (invoiceId) {
    const { data: invoice } = await db
      .from('tenant_invoices')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId)
      .maybeSingle();
    if (invoice) {
      links.push({
        label: 'Invoice',
        detail: formatInvoiceReference(invoice.id, invoice.title),
        href: `/billing/invoices/${invoice.id}`,
      });
    }
  } else {
    const { data: linkedInvoice } = await db
      .from('tenant_invoices')
      .select('id, title')
      .eq('tenant_id', tenantId)
      .eq('visit_id', visit.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (linkedInvoice) {
      links.push({
        label: 'Invoice',
        detail: formatInvoiceReference(linkedInvoice.id, linkedInvoice.title),
        href: `/billing/invoices/${linkedInvoice.id}`,
      });
    }
  }

  return { links };
}
