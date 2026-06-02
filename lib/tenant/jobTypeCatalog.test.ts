import { describe, expect, it } from 'vitest';
import {
  findCatalogEntry,
  resolveVisitDurationHours,
  type JobTypeCatalogEntry,
} from '@/lib/tenant/jobTypeCatalog';

const catalog: JobTypeCatalogEntry[] = [
  {
    id: 'a',
    service_label: 'Deep cleaning',
    name: 'Deep cleaning',
    job_type: 'residential',
    estimated_hours: 4,
    amount_cents: null,
    is_system_default: true,
    is_active: true,
    sort_order: 0,
  },
  {
    id: 'b',
    service_label: 'Deep cleaning',
    name: 'Deep cleaning',
    job_type: 'commercial',
    estimated_hours: 6,
    amount_cents: null,
    is_system_default: true,
    is_active: true,
    sort_order: 0,
  },
];

describe('findCatalogEntry', () => {
  it('matches by template id first', () => {
    const entry = findCatalogEntry(catalog, {
      serviceTemplateId: 'b',
      serviceLabel: 'Deep cleaning',
      propertyKind: 'residential',
    });
    expect(entry?.id).toBe('b');
  });

  it('matches service label and property kind', () => {
    const entry = findCatalogEntry(catalog, {
      serviceLabel: 'Deep cleaning',
      propertyKind: 'residential',
    });
    expect(entry?.estimated_hours).toBe(4);
  });
});

describe('resolveVisitDurationHours', () => {
  it('prefers line override over catalog default', () => {
    const hours = resolveVisitDurationHours({
      lineEstimatedHours: 5,
      catalogEntry: catalog[0],
    });
    expect(hours).toBe(5);
  });

  it('uses catalog default when line override is empty', () => {
    const hours = resolveVisitDurationHours({
      lineEstimatedHours: null,
      catalogEntry: catalog[0],
    });
    expect(hours).toBe(4);
  });

  it('falls back to two hours', () => {
    expect(resolveVisitDurationHours({})).toBe(2);
  });
});
