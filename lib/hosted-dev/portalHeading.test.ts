import { describe, expect, it } from 'vitest';
import { headingHasExactTitleText } from '@/lib/hosted-dev/portalHeading';

describe('portal heading title text', () => {
  it('matches the title element and ignores the hint inside the heading', () => {
    expect(
      headingHasExactTitleText(
        [
          'Customers Residential and commercial accounts you serve under this workspace.',
          'Customers',
          'Residential and commercial accounts you serve under this workspace.',
        ],
        'Customers',
      ),
    ).toBe(true);
    expect(
      headingHasExactTitleText(
        ['Quotes Drag cards between columns.', 'Quotes', 'Drag cards between columns.'],
        'Quotes',
      ),
    ).toBe(true);
    expect(
      headingHasExactTitleText(
        [
          'Billing Your Clean Scheduler plan and the tools you use to bill customers.',
          'Billing',
          'Your Clean Scheduler plan and the tools you use to bill customers.',
        ],
        'Billing',
      ),
    ).toBe(true);
    expect(headingHasExactTitleText(['Upcoming visits'], 'Upcoming visits')).toBe(true);
  });

  it('does not treat a different page as Customers, Quotes, Billing, or visits', () => {
    expect(headingHasExactTitleText(['No access to this workspace'], 'Customers')).toBe(false);
    expect(headingHasExactTitleText(['Sign in to Clean Scheduler'], 'Customers')).toBe(false);
    expect(headingHasExactTitleText(['Customer settings'], 'Customers')).toBe(false);
    expect(headingHasExactTitleText(['Quote requests'], 'Quotes')).toBe(false);
    expect(headingHasExactTitleText(['Billing settings'], 'Billing')).toBe(false);
    expect(headingHasExactTitleText(['No upcoming visits'], 'Upcoming visits')).toBe(false);
    expect(
      headingHasExactTitleText(['Upcoming visits', 'No upcoming visits'], 'No upcoming visits'),
    ).toBe(true);
    expect(headingHasExactTitleText(['Upcoming visits'], 'No upcoming visits')).toBe(false);
  });
});
