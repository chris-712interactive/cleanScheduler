import { describe, expect, it } from 'vitest';
import { parseRequiredCrewSize, requiredCrewForVisit } from '@/lib/schedule/crewSize';

describe('parseRequiredCrewSize', () => {
  it('defaults a blank value to one cleaner', () => {
    expect(parseRequiredCrewSize('')).toEqual({ ok: true, size: 1 });
    expect(parseRequiredCrewSize(null)).toEqual({ ok: true, size: 1 });
  });

  it('accepts a whole number from 1 to 8', () => {
    expect(parseRequiredCrewSize('2')).toEqual({ ok: true, size: 2 });
    expect(parseRequiredCrewSize(8)).toEqual({ ok: true, size: 8 });
  });

  it('rejects fractions and numbers outside 1 to 8', () => {
    expect(parseRequiredCrewSize('0').ok).toBe(false);
    expect(parseRequiredCrewSize('9').ok).toBe(false);
    expect(parseRequiredCrewSize('1.5').ok).toBe(false);
  });
});

const catalog = [
  {
    id: 'deep-home',
    serviceLabel: 'Deep cleaning',
    propertyKind: 'residential',
    crewSize: 2,
  },
  {
    id: 'deep-office',
    serviceLabel: 'Deep cleaning',
    propertyKind: 'commercial',
    crewSize: 3,
  },
  {
    id: 'standard-home',
    serviceLabel: 'Standard cleaning',
    propertyKind: 'residential',
    crewSize: 1,
  },
];

describe('requiredCrewForVisit', () => {
  it('uses the job type minimum when the location asks for fewer people', () => {
    expect(
      requiredCrewForVisit({
        propertyCrewSize: 1,
        propertyKind: 'residential',
        serviceLabel: 'Deep cleaning',
        catalog,
      }),
    ).toBe(2);
  });

  it('keeps the location crew when it is already higher', () => {
    expect(
      requiredCrewForVisit({
        propertyCrewSize: 4,
        propertyKind: 'residential',
        serviceLabel: 'Deep cleaning',
        catalog,
      }),
    ).toBe(4);
  });

  it('leaves a regular clean at the location crew', () => {
    expect(
      requiredCrewForVisit({
        propertyCrewSize: 1,
        propertyKind: 'residential',
        serviceLabel: 'Standard cleaning',
        catalog,
      }),
    ).toBe(1);
  });

  it('matches the template on the quote line before the title', () => {
    expect(
      requiredCrewForVisit({
        propertyCrewSize: 1,
        propertyKind: 'residential',
        serviceLabel: 'Custom title',
        serviceTemplateId: 'deep-office',
        catalog,
      }),
    ).toBe(3);
  });
});
