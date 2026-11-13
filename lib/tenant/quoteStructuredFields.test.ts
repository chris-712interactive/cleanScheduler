import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ENTRY_CODE_SAVE_WARNING,
  LOCATION_FACT_SYNC_WARNING,
  inlinePropertyDeferringLocationFacts,
  parseQuoteWizardStructuredFromForm,
  quoteLocationFactPatch,
  QUOTE_IN_FLIGHT_WARNING,
  quoteSaveNotice,
} from '@/lib/tenant/quoteStructuredFields';

describe('quote access notes', () => {
  it('keeps customer-visible access notes and does not store entry codes on the quote', () => {
    const form = new FormData();
    form.set('gate_code', '4412');
    form.set('door_code', '19');
    form.set('garage_code', '1553');
    form.set('access_notes', 'Dogs in the laundry room');
    form.set('scope_inclusions', '[]');

    const structured = parseQuoteWizardStructuredFromForm(form);
    expect(structured.propertySnapshot.access_notes).toBe('Dogs in the laundry room');
    expect(JSON.stringify(structured.propertySnapshot)).not.toContain('4412');
    expect(structured.customerNotes).toContain('Dogs in the laundry room');
    expect(structured.customerNotes).not.toContain('4412');
    expect(structured.customerNotes).not.toContain('1553');
  });

  it('keeps beds, baths, sqft, and site notes off the location until the quote RPC succeeds', () => {
    expect(
      inlinePropertyDeferringLocationFacts({
        address_line1: '1 Main',
        bedrooms: 3,
        bathrooms: 2,
        sqft: 1400,
        site_notes: 'Side gate',
        stories: 2,
      }),
    ).toEqual({ address_line1: '1 Main' });
    expect(
      quoteLocationFactPatch({
        bedrooms: 3,
        bathrooms: 2.5,
        sqft: 1400,
        stories: 2,
        access_notes: '  Side gate  ',
      }),
    ).toEqual({
      bedrooms: 3,
      bathrooms: 2.5,
      sqft: 1400,
      stories: 2,
      site_notes: 'Side gate',
    });

    const source = readFileSync('app/tenant/quotes/actions.ts', 'utf8');
    const start = source.indexOf('export async function createTenantQuote');
    const end = source.indexOf('export async function updateTenantQuote');
    const body = source.slice(start, end);
    const rpc = body.indexOf("rpc('tenant_quote_create_with_line_items'");
    const rejected = body.indexOf('if (rpc.error)');
    expect(rpc).toBeGreaterThan(-1);
    expect(rejected).toBeGreaterThan(rpc);
    expect(body).toContain('inlinePropertyDeferringLocationFacts');
    expect(body.indexOf('inlinePropertyDeferringLocationFacts')).toBeLessThan(rpc);
    const finish = body.indexOf('finishCreatedQuote');
    expect(finish).toBeGreaterThan(rejected);
    const helperStart = source.indexOf('async function finishCreatedQuote');
    const helperEnd = source.indexOf('async function rebuildPromotionSave');
    const helper = source.slice(helperStart, helperEnd);
    expect(helper.indexOf('syncPropertyFactsFromSnapshot')).toBeGreaterThan(-1);
    expect(helper.indexOf('storeQuoteEntryCodes')).toBeGreaterThan(
      helper.indexOf('syncPropertyFactsFromSnapshot'),
    );
    expect(quoteSaveNotice('location-facts')).toBe(LOCATION_FACT_SYNC_WARNING);
    expect(quoteSaveNotice('entry-codes')).toBe(ENTRY_CODE_SAVE_WARNING);
    expect(quoteSaveNotice('location-facts,entry-codes')).toBe(
      `${LOCATION_FACT_SYNC_WARNING} ${ENTRY_CODE_SAVE_WARNING}`,
    );
    expect(quoteSaveNotice('other')).toBeUndefined();
    expect(quoteSaveNotice('constructor')).toBeUndefined();
    expect(quoteSaveNotice('toString')).toBeUndefined();
    expect(quoteSaveNotice('__proto__')).toBeUndefined();
    expect(quoteSaveNotice('entry-codes,constructor')).toBe(ENTRY_CODE_SAVE_WARNING);
    expect(quoteSaveNotice('quote-in-flight')).toBe(QUOTE_IN_FLIGHT_WARNING);
    expect(QUOTE_IN_FLIGHT_WARNING).toContain('quote form');
    expect(QUOTE_IN_FLIGHT_WARNING).toContain('does not retry');
    expect(quoteSaveNotice('quote-in-flight,constructor')).toBe(QUOTE_IN_FLIGHT_WARNING);
  });

  it('uses the workspace default when the quote property type is omitted', () => {
    const form = new FormData();
    form.set('scope_inclusions', '[]');
    expect(parseQuoteWizardStructuredFromForm(form, 'commercial').jobType).toBe('commercial');
    expect(parseQuoteWizardStructuredFromForm(form).jobType).toBe('residential');
  });
});
