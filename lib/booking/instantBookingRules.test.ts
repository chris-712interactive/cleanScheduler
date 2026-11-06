import { describe, expect, it } from 'vitest';
import {
  instantOfferAllowedForSegment,
  instantPricingMethodAllowed,
  offerMatchesBookingSegment,
} from '@/lib/booking/bookingAudience';
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

  it('matches an offer audience to a tenant booking segment', () => {
    expect(offerMatchesBookingSegment('residential', 'residential')).toBe(true);
    expect(offerMatchesBookingSegment('commercial', 'residential')).toBe(false);
    expect(offerMatchesBookingSegment('commercial', 'both')).toBe(true);
    expect(offerMatchesBookingSegment('both', 'commercial')).toBe(false);
    expect(offerMatchesBookingSegment('both', 'both')).toBe(true);
  });

  it('does not keep a both-audience offer after the workspace narrows', () => {
    const savedWhileBoth = { audience: 'both', pricingMethod: 'per_sqft' };
    expect(instantOfferAllowedForSegment(savedWhileBoth, 'both')).toBe(true);
    expect(instantOfferAllowedForSegment(savedWhileBoth, 'residential')).toBe(false);
    expect(instantOfferAllowedForSegment(savedWhileBoth, 'commercial')).toBe(true);

    const homeSavedWhileBoth = { audience: 'both', pricingMethod: 'beds_baths' };
    expect(instantOfferAllowedForSegment(homeSavedWhileBoth, 'commercial')).toBe(false);
    expect(instantOfferAllowedForSegment(homeSavedWhileBoth, 'residential')).toBe(true);

    const flatSavedWhileBoth = { audience: 'both', pricingMethod: 'flat' };
    expect(instantOfferAllowedForSegment(flatSavedWhileBoth, 'residential')).toBe(false);
    expect(instantOfferAllowedForSegment(flatSavedWhileBoth, 'commercial')).toBe(false);
    expect(instantOfferAllowedForSegment(flatSavedWhileBoth, 'both')).toBe(true);
  });

  it('uses a linked job type when the stamped audience is both', () => {
    expect(
      instantOfferAllowedForSegment(
        { audience: 'both', pricingMethod: 'flat', templateJobType: 'commercial' },
        'residential',
      ),
    ).toBe(false);
    expect(
      instantOfferAllowedForSegment(
        { audience: 'both', pricingMethod: 'flat', templateJobType: 'residential' },
        'commercial',
      ),
    ).toBe(false);
  });

  it('blocks square-foot booking prices on a residential workspace', () => {
    expect(instantPricingMethodAllowed('per_sqft', 'residential')).toBe(false);
    expect(instantPricingMethodAllowed('per_sqft', 'commercial')).toBe(true);
    expect(instantPricingMethodAllowed('per_sqft', 'both')).toBe(true);
    expect(instantPricingMethodAllowed('beds_baths', 'commercial')).toBe(false);
    expect(instantPricingMethodAllowed('flat', 'residential')).toBe(true);
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
