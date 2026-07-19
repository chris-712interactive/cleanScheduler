import { describe, expect, it } from 'vitest';
import { pickChecklistTemplateItems } from '@/lib/visits/visitChecklistState';

describe('pickChecklistTemplateItems', () => {
  const consultationItems = [{ id: 'c1', label: 'Measure rooms' }];
  const serviceItems = [{ id: 's1', label: 'Wipe counters' }];

  it('uses consultation checklist for consultation visits', () => {
    const items = pickChecklistTemplateItems({
      visitPurpose: 'consultation',
      consultationChecklistItems: consultationItems,
      serviceChecklistItems: serviceItems,
    });
    expect(items).toEqual(consultationItems);
  });

  it('uses crew checklist for service visits', () => {
    const items = pickChecklistTemplateItems({
      visitPurpose: 'service',
      consultationChecklistItems: consultationItems,
      serviceChecklistItems: serviceItems,
    });
    expect(items).toEqual(serviceItems);
  });

  it('returns empty when consultation has no template items', () => {
    expect(
      pickChecklistTemplateItems({
        visitPurpose: 'consultation',
        consultationChecklistItems: [],
        serviceChecklistItems: serviceItems,
      }),
    ).toEqual([]);
  });
});
