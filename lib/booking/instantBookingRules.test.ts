import { describe, expect, it } from 'vitest';
import { offerMatchesBookingSegment } from '@/lib/booking/bookingAudience';
import { depositForPrice, priceInstantOffer } from '@/lib/booking/priceInstantOffer';
import { recurringRuleFromFrequency } from '@/lib/booking/recurringRuleFromFrequency';
import { matchBookingZone } from '@/lib/booking/serviceZoneMatch';
import { isPublicBookingHref } from '@/lib/booking/isPublicBookingHref';

describe('instant booking price and zones', () => {
  it('prices a home by beds and baths', () => {
    const priced = priceInstantOffer({
      method: 'beds_baths',
      baseAmountCents: 8000,
      perSqftCents: 0,
      perBedroomCents: 1500,
      perBathroomCents: 2000,
      sqft: null,
      bedrooms: 3,
      bathrooms: 2.5,
    });
    expect(priced).toEqual({ amountCents: 8000 + 4500 + 5000 });
  });

  it('requires square footage for per-sqft pricing', () => {
    const priced = priceInstantOffer({
      method: 'per_sqft',
      baseAmountCents: 5000,
      perSqftCents: 10,
      perBedroomCents: 0,
      perBathroomCents: 0,
      sqft: null,
      bedrooms: 3,
      bathrooms: 2,
    });
    expect(priced).toEqual({ error: 'Square footage is required for this price.' });
  });

  it('caps the deposit at the visit price', () => {
    expect(depositForPrice(4000, 7500)).toBe(4000);
    expect(depositForPrice(12000, 5000)).toBe(5000);
  });

  it('keeps instant booking residential until a segment is passed in', () => {
    expect(offerMatchesBookingSegment('residential', 'residential')).toBe(true);
    expect(offerMatchesBookingSegment('commercial', 'residential')).toBe(false);
    expect(offerMatchesBookingSegment('commercial', 'both')).toBe(true);
    expect(offerMatchesBookingSegment('both', 'commercial')).toBe(true);
  });

  it('matches ZIP coverage and offer zones', () => {
    const coverage = [{ zoneId: 'zone-a', postalCodes: ['33982'] }];
    expect(matchBookingZone({ postalCode: '33982-1234', coverage, offerZoneIds: [] }).ok).toBe(
      true,
    );
    expect(matchBookingZone({ postalCode: '10001', coverage, offerZoneIds: [] })).toMatchObject({
      ok: false,
    });
    expect(
      matchBookingZone({
        postalCode: '33982',
        coverage,
        offerZoneIds: ['zone-b'],
      }),
    ).toMatchObject({ ok: false });
  });

  it('builds a weekly rule from the UTC anchor weekday', () => {
    const rule = recurringRuleFromFrequency({
      frequency: 'weekly',
      startsAt: '2026-06-03T13:00:00.000Z',
    });
    expect(rule).toBe('FREQ=WEEKLY;INTERVAL=1;BYDAY=WE');
    expect(
      recurringRuleFromFrequency({
        frequency: 'one_time',
        startsAt: '2026-06-03T13:00:00.000Z',
      }),
    ).toBeNull();
  });

  it('recognizes public booking paths', () => {
    expect(isPublicBookingHref('/book')).toBe(true);
    expect(isPublicBookingHref('https://acme.example.com/request')).toBe(true);
    expect(isPublicBookingHref('/contact')).toBe(false);
  });
});
