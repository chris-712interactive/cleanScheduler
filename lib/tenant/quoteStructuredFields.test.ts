import { describe, expect, it } from 'vitest';
import {
  composeCustomerQuoteNotes,
  formatOfficeAccessCodes,
  parseQuoteWizardStructuredFromForm,
} from '@/lib/tenant/quoteStructuredFields';

describe('quote office access codes', () => {
  it('keeps gate, door, and garage codes off the customer quote', () => {
    const form = new FormData();
    form.set('gate_code', '4412');
    form.set('door_code', '19');
    form.set('garage_code', '1553');
    form.set('access_notes', 'Dogs in the laundry room');
    form.set('scope_inclusions', '[]');

    const structured = parseQuoteWizardStructuredFromForm(form);
    expect(formatOfficeAccessCodes(structured.propertySnapshot)).toBe(
      'Gate code: 4412\nDoor code: 19\nGarage code: 1553',
    );
    expect(structured.customerNotes).toContain('Dogs in the laundry room');
    expect(structured.customerNotes).not.toContain('4412');
    expect(structured.customerNotes).not.toContain('1553');
    expect(
      composeCustomerQuoteNotes({
        scope: structured.scopeSnapshot,
        property: structured.propertySnapshot,
      }),
    ).not.toContain('Gate code');
  });
});
