import { describe, expect, it } from 'vitest';
import {
  consultationIntakeErrors,
  formatConsultationIntakeSummary,
  isConsultationIntakeComplete,
  parseConsultationIntakeForm,
  parseConsultationRequiredFields,
  parseStoredConsultationIntake,
  quotePrefillFromConsultation,
} from '@/lib/visits/consultationIntake';

function residentialForm(overrides: Record<string, string> = {}): FormData {
  const form = new FormData();
  const values: Record<string, string> = {
    service_requested: 'recurring',
    frequency: 'biweekly',
    sqft: '1800',
    condition: 'average',
    supplies: 'company',
    preferred_start: '2026-10-20',
    areas_in_scope: 'Kitchen\nBathrooms',
    areas_out_of_scope: 'Garage',
    bedrooms: '3',
    bathrooms: '2.5',
    stories: '2',
    pets: 'dog',
    pet_count: '1',
    occupied_during_clean: 'yes',
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) form.set(key, value);
  return form;
}

describe('consultation intake', () => {
  it('accepts a complete residential walkthrough', () => {
    const intake = parseConsultationIntakeForm(residentialForm(), 'residential');
    expect(consultationIntakeErrors(intake)).toEqual([]);
    expect(intake.bathrooms).toBe(2.5);
    expect(intake.petCount).toBe(1);
  });

  it('treats every field as optional until the tenant marks it required', () => {
    const intake = parseConsultationIntakeForm(new FormData(), 'residential');
    expect(consultationIntakeErrors(intake)).toEqual([]);
    expect(isConsultationIntakeComplete(null)).toBe(true);
    expect(consultationIntakeErrors(intake, ['sqft', 'bedrooms'])).toEqual([
      'Square footage is required.',
      'Bedrooms is required.',
    ]);
    expect(parseConsultationRequiredFields(['sqft', 'not-a-field', 4])).toEqual(['sqft']);
  });

  it('requires a pet count when pets are present', () => {
    const intake = parseConsultationIntakeForm(residentialForm({ pet_count: '' }), 'residential');
    expect(consultationIntakeErrors(intake)).toContain('Pet count is required.');
  });

  it('requires commercial space details only when the tenant asks for them', () => {
    const form = new FormData();
    form.set('service_requested', 'recurring');
    form.set('frequency', 'weekly');
    form.set('sqft', '4000');
    form.set('condition', 'light');
    form.set('supplies', 'company');
    form.set('preferred_start', '2026-11-02');
    form.set('areas_in_scope', 'Open office');
    form.set('areas_out_of_scope', 'Server room');
    const intake = parseConsultationIntakeForm(form, 'commercial');
    expect(consultationIntakeErrors(intake)).toEqual([]);
    expect(consultationIntakeErrors(intake, ['space_type', 'restrooms', 'on_site_window'])).toEqual(
      expect.arrayContaining([
        'Space type is required.',
        'Restrooms is required.',
        'When the crew can be on site is required.',
      ]),
    );
    expect(consultationIntakeErrors(intake, ['bedrooms'])).toEqual([]);
  });

  it('requires a custom cadence description', () => {
    const intake = parseConsultationIntakeForm(
      residentialForm({ frequency: 'custom', frequency_detail: '' }),
      'short_term_rental',
    );
    expect(consultationIntakeErrors(intake)).toContain('Custom cadence is required.');
  });

  it('round-trips stored answers into a quote prefill', () => {
    const intake = parseConsultationIntakeForm(residentialForm(), 'residential');
    const stored = parseStoredConsultationIntake(intake);
    expect(stored?.sqft).toBe(1800);
    const prefill = quotePrefillFromConsultation(stored!);
    expect(prefill.serviceLabel).toBe('Recurring maintenance');
    expect(prefill.frequency).toBe('biweekly');
    expect(prefill.scopeInclusions).toEqual(['Kitchen', 'Bathrooms']);
    expect(prefill.bedrooms).toBe('3');
    expect(formatConsultationIntakeSummary(stored!)).toContain('Pets: Dog (1)');
  });
});
