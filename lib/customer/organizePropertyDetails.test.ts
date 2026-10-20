import { describe, expect, it } from 'vitest';
import { organizePropertyDetails } from '@/lib/customer/organizePropertyDetails';

const SUMMARY =
  'Service: Recurring maintenance How often: Weekly Square footage: 2500 Condition: Average Supplies: Customer provides supplies Preferred start: 2026-10-12 In scope: Bathrooms Living Room Kitchen Bedrooms Out of scope: Windows Garage Home Office Bedrooms: 4 Bathrooms: 2.5 Stories: 2 Pets: Dog (1) Occupied during clean: Yes Kids at home: Yes Home office: Yes Same cleaner each visit: Yes Floors: Hardwood Last professional clean: 1–6 months ago Crew estimate: 3 hours';

describe('organizePropertyDetails', () => {
  it('groups a consultation summary into sections', () => {
    const details = organizePropertyDetails({ siteNotes: SUMMARY });
    expect(details.service.map((fact) => fact.label)).toEqual([
      'Service',
      'How often',
      'Condition',
      'Supplies',
      'Preferred start',
      'Crew estimate',
    ]);
    expect(details.service[0]?.value).toBe('Recurring maintenance');
    expect(details.home.find((fact) => fact.label === 'Bedrooms')?.value).toBe('4');
    expect(details.home.find((fact) => fact.label === 'Bathrooms')?.value).toBe('2.5');
    expect(details.included.find((fact) => fact.label === 'In scope')?.value).toBe(
      'Bathrooms Living Room Kitchen Bedrooms',
    );
    expect(details.household.find((fact) => fact.label === 'Pets')?.value).toBe('Dog (1)');
    expect(details.notes).toBe('');
  });

  it('keeps rooms on their own lines inside the scope', () => {
    const details = organizePropertyDetails({
      siteNotes: 'In scope:\nBathrooms\nLiving Room\nOut of scope:\nWindows',
    });
    expect(details.included.find((fact) => fact.label === 'In scope')?.value).toBe(
      'Bathrooms\nLiving Room',
    );
    expect(details.included.find((fact) => fact.label === 'Out of scope')?.value).toBe('Windows');
  });

  it('keeps a plain note when there are no labels', () => {
    const details = organizePropertyDetails({ siteNotes: 'Gate code is 1234.' });
    expect(details.notes).toBe('Gate code is 1234.');
    expect(details.service).toEqual([]);
  });

  it('fills home facts from the property when the note does not mention them', () => {
    const details = organizePropertyDetails({
      siteNotes: 'Gate code is 1234.',
      bedrooms: 3,
      sqft: 1800,
    });
    expect(details.home).toEqual([
      { label: 'Bedrooms', value: '3' },
      { label: 'Square footage', value: '1800' },
    ]);
  });
});
