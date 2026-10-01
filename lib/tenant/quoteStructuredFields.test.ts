import { describe, expect, it } from 'vitest';
import { parseQuoteWizardStructuredFromForm } from '@/lib/tenant/quoteStructuredFields';

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
});
