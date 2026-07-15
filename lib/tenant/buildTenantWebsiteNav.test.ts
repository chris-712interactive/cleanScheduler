import { describe, expect, it } from 'vitest';
import { buildTenantWebsiteNavItems } from '@/lib/tenant/buildTenantWebsiteNav';

describe('buildTenantWebsiteNavItems', () => {
  it('returns booking + leads when only booking request is enabled', () => {
    expect(
      buildTenantWebsiteNavItems({
        websiteEnabled: false,
        websitePublished: false,
        bookingRequestEnabled: true,
        newLeadsCount: 3,
      }),
    ).toEqual([
      { label: 'Booking requests', href: '/settings/booking-requests', icon: 'inquiries' },
      { label: 'Leads', href: '/settings/website/leads', icon: 'inquiries', badge: 3 },
    ]);
  });

  it('returns website only before publish when booking is off', () => {
    expect(
      buildTenantWebsiteNavItems({
        websiteEnabled: true,
        websitePublished: false,
        bookingRequestEnabled: false,
        newLeadsCount: 0,
      }),
    ).toEqual([{ label: 'Website', href: '/settings/website', icon: 'website' }]);
  });

  it('adds leads with badge when the site is live', () => {
    expect(
      buildTenantWebsiteNavItems({
        websiteEnabled: true,
        websitePublished: true,
        bookingRequestEnabled: false,
        newLeadsCount: 2,
      }),
    ).toEqual([
      { label: 'Website', href: '/settings/website', icon: 'website' },
      { label: 'Leads', href: '/settings/website/leads', icon: 'inquiries', badge: 2 },
    ]);
  });
});
