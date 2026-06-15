import { describe, expect, it } from 'vitest';
import { buildTenantWebsiteNavItems } from '@/lib/tenant/buildTenantWebsiteNav';

describe('buildTenantWebsiteNavItems', () => {
  it('returns no items when website feature is disabled', () => {
    expect(
      buildTenantWebsiteNavItems({
        websiteEnabled: false,
        websitePublished: true,
        newLeadsCount: 3,
      }),
    ).toEqual([]);
  });

  it('returns website only before publish', () => {
    expect(
      buildTenantWebsiteNavItems({
        websiteEnabled: true,
        websitePublished: false,
        newLeadsCount: 0,
      }),
    ).toEqual([{ label: 'Website', href: '/settings/website', icon: 'website' }]);
  });

  it('adds leads with badge when the site is live', () => {
    expect(
      buildTenantWebsiteNavItems({
        websiteEnabled: true,
        websitePublished: true,
        newLeadsCount: 2,
      }),
    ).toEqual([
      { label: 'Website', href: '/settings/website', icon: 'website' },
      { label: 'Leads', href: '/settings/website/leads', icon: 'inquiries', badge: 2 },
    ]);
  });
});
