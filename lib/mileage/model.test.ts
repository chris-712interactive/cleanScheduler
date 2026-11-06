import { describe, expect, it } from 'vitest';
import { checkInIsAwayFromStop } from '@/lib/mileage/checkInDistance';
import {
  applySavedAndSuggested,
  chooseLegMiles,
  countedMiles,
  DEFAULT_MILEAGE_SETTINGS,
  insertStop,
  legIsIncluded,
  mileageCsv,
  mileageApprovalRequired,
  milesFromRoutePayload,
  odometerSummary,
  pairStops,
  reimbursementCents,
  segmentKey,
  type MileageSettings,
  type MileageStop,
} from '@/lib/mileage/model';

const settings: MileageSettings = { ...DEFAULT_MILEAGE_SETTINGS };

function stop(
  label: string,
  kind: MileageStop['kind'],
  extra: Partial<MileageStop> = {},
): MileageStop {
  return {
    label,
    kind,
    address: extra.address ?? label,
    visitId: extra.visitId ?? null,
    lat: extra.lat ?? null,
    lng: extra.lng ?? null,
    checkInAway: extra.checkInAway ?? false,
  };
}

describe('mileage day rules', () => {
  const day = [
    stop('Home', 'home'),
    stop('14 Maple St', 'visit', { visitId: 'v1' }),
    stop('88 Oak Ave', 'visit', { visitId: 'v2' }),
    stop('Home', 'home'),
  ];

  it('leaves the commute and the drive home off by default', () => {
    const legs = pairStops(day, settings);
    expect(legs.map((leg) => [leg.destLabel, leg.included])).toEqual([
      ['14 Maple St', false],
      ['88 Oak Ave', true],
      ['Home', false],
    ]);
    expect(
      countedMiles(legs.map((leg, index) => ({ ...leg, miles: [8.2, 6.2, 9][index] ?? 0 }))),
    ).toBe(6.2);
  });

  it('counts an office event both ways', () => {
    const legs = pairStops(
      [stop('Office', 'office'), stop('Chamber breakfast', 'event'), stop('Office', 'office')],
      settings,
    );
    expect(legs.every((leg) => leg.included)).toBe(true);
  });

  it('inserts a supply stop ahead of the drive home', () => {
    const legs = pairStops(day, settings);
    const next = insertStop(legs, stop('Janitorial supply', 'supply'), settings);
    expect(next.map((leg) => leg.destLabel)).toEqual([
      '14 Maple St',
      '88 Oak Ave',
      'Janitorial supply',
      'Home',
    ]);
    expect(legIsIncluded('visit', 'supply', settings)).toBe(true);
  });
});

describe('reimbursement and odometer', () => {
  it('stays miles-only until the tenant turns pay on', () => {
    expect(
      reimbursementCents({
        settings,
        vehicle: 'personal',
        counted: 12.7,
      }),
    ).toBeNull();
  });

  it('pays a personal car and keeps a company van at zero', () => {
    const paying = { ...settings, reimbursementEnabled: true, rateCentsPerMile: 70 };
    expect(reimbursementCents({ settings: paying, vehicle: 'personal', counted: 12.7 })).toBe(889);
    expect(reimbursementCents({ settings: paying, vehicle: 'company', counted: 24 })).toBe(0);
  });

  it('compares the odometer with every trip on the list', () => {
    expect(odometerSummary(48210, 48246, 29.9)).toEqual({ driven: 36, gap: 6.1 });
    expect(odometerSummary(120440, 120464, 24)).toEqual({ driven: 24, gap: 0 });
    expect(odometerSummary(10, 9, 1).driven).toBeNull();
  });
});

describe('mile sources', () => {
  it('asks the office to approve only when mileage is reimbursed', () => {
    expect(mileageApprovalRequired({ reimbursementEnabled: false })).toBe(false);
    expect(mileageApprovalRequired({ reimbursementEnabled: true })).toBe(true);
  });

  it('prefers a saved pair, then a suggested road mile, then a typed mile', () => {
    expect(
      chooseLegMiles({
        savedMiles: 6.2,
        suggestedMiles: 6.4,
        typedMiles: 9,
        typedEdited: false,
      }),
    ).toEqual({ miles: 6.2, source: 'saved' });
    expect(
      chooseLegMiles({
        savedMiles: null,
        suggestedMiles: 4.4,
        typedMiles: null,
        typedEdited: false,
      }),
    ).toEqual({ miles: 4.4, source: 'suggested' });
    expect(
      chooseLegMiles({
        savedMiles: 6.2,
        suggestedMiles: 6.4,
        typedMiles: 7,
        typedEdited: true,
      }),
    ).toEqual({ miles: 7, source: 'typed' });
  });

  it('fills legs from saved and suggested pairs', () => {
    const [leg] = pairStops(
      [stop('A', 'visit', { lat: 1, lng: 2 }), stop('B', 'visit', { lat: 3, lng: 4 })],
      settings,
    );
    expect(leg).toBeDefined();
    const key = `${segmentKey('A', 1, 2)}|${segmentKey('B', 3, 4)}`;
    const [filled] = applySavedAndSuggested([leg!], new Map(), new Map([[key, 4.4]]));
    expect(filled?.source).toBe('suggested');
    expect(filled?.miles).toBe(4.4);
  });

  it('reads driving meters from a Mapricot route and ignores a missing route', () => {
    expect(milesFromRoutePayload({ routes: [{ distanceMeters: 1609 }] })).toBe(1);
    expect(milesFromRoutePayload({ routes: [] })).toBeNull();
    expect(milesFromRoutePayload(null)).toBeNull();
  });

  it('keys a repeated address by rounded coordinates', () => {
    expect(segmentKey('14 Maple St', 40.71234, -74.00611)).toBe('geo:40.7123,-74.0061');
    expect(segmentKey('  Chamber   Breakfast ', null, null)).toBe('addr:chamber breakfast');
  });
});

describe('check-in flag and csv', () => {
  it('flags a check-in far from the property without moving the stop', () => {
    expect(checkInIsAwayFromStop({ lat: 40.7, lng: -74 }, { lat: 40.71, lng: -74 })).toBe(true);
    expect(checkInIsAwayFromStop({ lat: 40.7, lng: -74 }, { lat: 40.7001, lng: -74 })).toBe(false);
  });

  it('hides the amount column when reimbursement is off', () => {
    const csv = mileageCsv(
      [
        {
          date: '2026-11-04',
          person: 'Maria Gonzalez',
          vehicle: 'personal',
          miles: '12.7',
          amount: null,
          status: 'draft',
        },
      ],
      false,
    );
    expect(csv.split('\n')[0]).toBe('Date,Person,Vehicle,Miles,Status');
    expect(csv).not.toContain('Amount');
  });
});
