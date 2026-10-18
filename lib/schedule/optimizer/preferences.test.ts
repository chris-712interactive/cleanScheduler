import { describe, expect, it } from 'vitest';
import { pointFromCensusResponse } from '@/lib/geo/censusGeocode';
import {
  effectiveSchedulingFacts,
  emptySchedulingFacts,
  parseTagList,
  schedulingArrivalWindow,
  schedulingFactsFromRow,
  schedulingFactsToOverride,
  type SchedulingFactsRow,
} from '@/lib/schedule/optimizer/preferences';

const baseRow: SchedulingFactsRow = {
  preferred_user_ids: [],
  required_user_ids: [],
  blocked_user_ids: [],
  arrival_start: null,
  arrival_end: null,
  access_start: null,
  access_end: null,
  pet_in_home: false,
  chemical_sensitivity: false,
  language_codes: [],
  required_attribute_tags: [],
  priority: 3,
  required_skill_tags: [],
  required_certification_tags: [],
  required_equipment_tags: [],
  requires_key_pickup: false,
};

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
      required_skill_tags: [],
      required_certification_tags: [],
      required_equipment_tags: [],
      requires_key_pickup: false,
    });
    const override = schedulingFactsToOverride({
      ...emptySchedulingFacts(),
      petInHome: true,
      priority: 5,
    });

    const effective = effectiveSchedulingFacts(customer, override);
    expect(effective.petInHome).toBe(true);
    expect(effective.priority).toBe(5);
    expect(effectiveSchedulingFacts(customer, null).arrivalWindow).toEqual({
      startMin: 9 * 60,
      endMin: 12 * 60,
    });
  });

  it('turns a time of day into an arrival window and keeps a tighter window', () => {
    const facts = schedulingFactsFromRow({
      ...baseRow,
      preferred_weekdays: ['thu', 'tue', 'nope'],
      preferred_time_window: 'afternoon',
    });
    expect(facts.preferredWeekdays).toEqual(['tue', 'thu']);
    expect(schedulingArrivalWindow(facts)).toEqual({ startMin: 12 * 60, endMin: 16 * 60 });

    const tighter = {
      ...facts,
      arrivalWindow: { startMin: 9 * 60, endMin: 11 * 60 },
    };
    expect(schedulingArrivalWindow(tighter)?.startMin).toBe(9 * 60);
  });

  it('keeps the customer days when a property override does not mention them', () => {
    const customer = schedulingFactsFromRow({
      ...baseRow,
      preferred_weekdays: ['wed'],
      preferred_time_window: 'morning',
    });
    expect(effectiveSchedulingFacts(customer, { petInHome: true }).preferredWeekdays).toEqual([
      'wed',
    ]);
    expect(
      effectiveSchedulingFacts(customer, { preferredWeekdays: ['fri'], preferredTimeWindow: null })
        .preferredTimeWindow,
    ).toBeNull();
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
