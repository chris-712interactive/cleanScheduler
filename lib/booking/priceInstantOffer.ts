import type { BookingServiceAudience } from '@/lib/booking/bookingAudience';

export type InstantPricingMethod = 'flat' | 'per_sqft' | 'beds_baths';

export type InstantBookingFrequency = 'one_time' | 'weekly' | 'biweekly' | 'monthly';

export type InstantOfferPriceInput = {
  method: InstantPricingMethod;
  baseAmountCents: number;
  perSqftCents: number;
  perBedroomCents: number;
  perBathroomCents: number;
  sqft: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
};

export function priceInstantOffer(
  input: InstantOfferPriceInput,
): { amountCents: number } | { error: string } {
  if (input.method === 'flat') {
    if (input.baseAmountCents <= 0) return { error: 'This service is not priced yet.' };
    return { amountCents: input.baseAmountCents };
  }

  if (input.method === 'per_sqft') {
    if (input.sqft == null || input.sqft <= 0) {
      return { error: 'Square footage is required for this price.' };
    }
    const total = input.baseAmountCents + input.sqft * input.perSqftCents;
    if (total <= 0) return { error: 'This service is not priced yet.' };
    return { amountCents: total };
  }

  if (input.bedrooms == null || input.bathrooms == null) {
    return { error: 'Bedrooms and bathrooms are required for this price.' };
  }
  if (input.bedrooms < 0 || input.bathrooms < 0) {
    return { error: 'Bedrooms and bathrooms must be zero or more.' };
  }
  const total =
    input.baseAmountCents +
    input.bedrooms * input.perBedroomCents +
    Math.round(input.bathrooms * input.perBathroomCents);
  if (total <= 0) return { error: 'This service is not priced yet.' };
  return { amountCents: total };
}

export function depositForPrice(priceCents: number, configuredDepositCents: number): number {
  if (configuredDepositCents <= 0 || priceCents <= 0) return 0;
  return Math.min(configuredDepositCents, priceCents);
}

export type RecurringFrequencyFlags = {
  allowRecurring: boolean;
  allowWeekly: boolean;
  allowBiweekly: boolean;
  allowMonthly: boolean;
};

export function frequencyAllowed(
  frequency: InstantBookingFrequency,
  flags: RecurringFrequencyFlags,
): boolean {
  if (frequency === 'one_time') return true;
  if (!flags.allowRecurring) return false;
  if (frequency === 'weekly') return flags.allowWeekly;
  if (frequency === 'biweekly') return flags.allowBiweekly;
  return flags.allowMonthly;
}

export function allowedFrequencies(flags: RecurringFrequencyFlags): InstantBookingFrequency[] {
  const all: InstantBookingFrequency[] = ['one_time', 'weekly', 'biweekly', 'monthly'];
  return all.filter((frequency) => frequencyAllowed(frequency, flags));
}

export const INSTANT_BOOKING_DEFAULT_AUDIENCE: BookingServiceAudience = 'residential';
