import { describe, expect, it } from 'vitest';
import { pointFromCensusResponse } from '@/lib/geo/censusGeocode';
import {
  effectiveSchedulingFacts,
  emptySchedulingFacts,
  parseTagList,
  schedulingFactsFromRow,
  schedulingFactsToOverride,
} from '@/lib/schedule/optimizer/preferences';

describe('scheduling preferences', () => {
  it('parses comma-separated tags without duplicates', () => {
    expect(parseTagList(' Floor Care, floor-care\ngreen only ')).toEqual([
      'floor-care',
      'green-only',
    ]);
  });

  it('uses a property override when one is saved', () => {
    const customer = schedulingFactsFromRow({
      preferred_user_ids: ['11111111-1111-4111-8111-111111111111'],
      required_user_ids: [],
      blocked_user_ids: [],
      arrival_start: '09:00',
      arrival_end: '12:00',
      access_start: null,
      access_end: null,
      pet_in_home: false,
      chemical_sensitivity: false,
      language_codes: [],
      required_attribute_tags: [],
      priority: 3,
      required_crew_size: 1,
      required_skill_tags: [],
      required_certification_tags: [],
      required_equipment_tags: [],
      requires_key_pickup: false,
    });
    const override = schedulingFactsToOverride({
      ...emptySchedulingFacts(),
      petInHome: true,
      requiredCrewSize: 2,
      priority: 5,
    });

    const effective = effectiveSchedulingFacts(customer, override);
    expect(effective.petInHome).toBe(true);
    expect(effective.requiredCrewSize).toBe(2);
    expect(effective.priority).toBe(5);
    expect(effectiveSchedulingFacts(customer, null).arrivalWindow).toEqual({
      startMin: 9 * 60,
      endMin: 12 * 60,
    });
  });
});

describe('census geocoder response', () => {
  it('reads longitude from x and latitude from y', () => {
    expect(
      pointFromCensusResponse({
        result: { addressMatches: [{ coordinates: { x: -81.76, y: 26.72 } }] },
      }),
    ).toEqual({ lat: 26.72, lng: -81.76 });
    expect(pointFromCensusResponse({ result: { addressMatches: [] } })).toBeNull();
  });
});
