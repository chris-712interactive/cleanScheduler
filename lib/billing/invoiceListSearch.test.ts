import { describe, expect, it } from 'vitest';
import {
  buildInvoiceListOrFilter,
  invoiceAmountCentsFromQuery,
  invoiceIdPrefixFromQuery,
  parseInvoiceListQuery,
  uuidPrefixBounds,
} from '@/lib/billing/invoiceListSearch';

const CUSTOMER_ID = '11111111-1111-4111-8111-111111111111';

describe('parseInvoiceListQuery', () => {
  it('trims and caps the query', () => {
    expect(parseInvoiceListQuery('  Wayne  ')).toBe('Wayne');
    expect(parseInvoiceListQuery(undefined)).toBe('');
    expect(parseInvoiceListQuery('a'.repeat(200))).toHaveLength(120);
  });
});

describe('invoice id search', () => {
  it('reads the displayed invoice number as a uuid prefix', () => {
    expect(invoiceIdPrefixFromQuery('INV-AF1A7F')).toBe('af1a7f');
    expect(invoiceIdPrefixFromQuery('Invoice #INV-AF1A7F')).toBe('af1a7f');
    expect(invoiceIdPrefixFromQuery('af1a7f')).toBe('af1a7f');
  });

  it('leaves short street numbers and customer names alone', () => {
    expect(invoiceIdPrefixFromQuery('200')).toBeNull();
    expect(invoiceIdPrefixFromQuery('Wayne Kendig')).toBeNull();
  });

  it('bounds the prefix so only matching invoice ids qualify', () => {
    const bounds = uuidPrefixBounds('af1a7f');
    expect(bounds).toEqual({
      gte: 'af1a7f00-0000-0000-0000-000000000000',
      lt: 'af1a8000-0000-0000-0000-000000000000',
    });
    const sample = 'af1a7f12-3456-7890-abcd-ef1234567890';
    expect(sample >= bounds!.gte && sample < bounds!.lt!).toBe(true);
    expect('af1a8012-0000-0000-0000-000000000000' < bounds!.lt!).toBe(false);
  });
});

describe('invoiceAmountCentsFromQuery', () => {
  it('parses dollar amounts and plain totals', () => {
    expect(invoiceAmountCentsFromQuery('$200.00')).toBe(20000);
    expect(invoiceAmountCentsFromQuery('200')).toBe(20000);
    expect(invoiceAmountCentsFromQuery('Wayne')).toBeNull();
  });
});

describe('buildInvoiceListOrFilter', () => {
  it('matches invoice text, the id prefix, and customer ids', () => {
    const filter = buildInvoiceListOrFilter({
      query: 'INV-AF1A7F',
      customerIds: [CUSTOMER_ID, 'not-a-uuid'],
    });
    expect(filter).toContain('title.ilike.%INV-AF1A7F%');
    expect(filter).toContain('notes.ilike.%INV-AF1A7F%');
    expect(filter).toContain(
      'and(id.gte.af1a7f00-0000-0000-0000-000000000000,id.lt.af1a8000-0000-0000-0000-000000000000)',
    );
    expect(filter).toContain(`customer_id.in.(${CUSTOMER_ID})`);
    expect(filter).not.toContain('not-a-uuid');
  });

  it('quotes address punctuation and matches a status or amount', () => {
    expect(buildInvoiceListOrFilter({ query: 'Wayne Kendig', customerIds: [] })).toContain(
      'title.ilike.%Wayne Kendig%',
    );
    expect(buildInvoiceListOrFilter({ query: 'Main St.', customerIds: [] })).toContain(
      'title.ilike."%Main St.%"',
    );
    expect(buildInvoiceListOrFilter({ query: 'paid', customerIds: [] })).toContain(
      'status.eq.paid',
    );
    expect(buildInvoiceListOrFilter({ query: '$300.00', customerIds: [] })).toContain(
      'amount_cents.eq.30000',
    );
  });

  it('returns null when there is nothing to search', () => {
    expect(buildInvoiceListOrFilter({ query: '   ', customerIds: [] })).toBeNull();
  });
});
