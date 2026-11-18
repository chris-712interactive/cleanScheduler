import { describe, expect, it } from 'vitest';
import { inferPortalFromHost } from '@/lib/portal/inferPortalFromHost';

describe('inferPortalFromHost', () => {
  it('reads the tenant workspace and the customer portal from the host', () => {
    expect(inferPortalFromHost('acme.cleanscheduler.com', 'cleanscheduler.com')).toEqual({
      kind: 'tenant',
      tenantSlug: 'acme',
    });
    expect(inferPortalFromHost('my.cleanscheduler.com', 'cleanscheduler.com')).toEqual({
      kind: 'customer',
      tenantSlug: null,
    });
    expect(inferPortalFromHost('acme.lvh.me:3000', 'lvh.me:3000')).toEqual({
      kind: 'tenant',
      tenantSlug: 'acme',
    });
  });

  it('leaves the marketing host unlabeled', () => {
    expect(inferPortalFromHost('cleanscheduler.com', 'cleanscheduler.com').kind).toBe('marketing');
    expect(inferPortalFromHost('www.cleanscheduler.com', 'cleanscheduler.com').kind).toBe(
      'marketing',
    );
    expect(inferPortalFromHost('admin.cleanscheduler.com', 'cleanscheduler.com').kind).toBe(
      'admin',
    );
    expect(inferPortalFromHost('admin.evil.cleanscheduler.com', 'cleanscheduler.com')).toEqual({
      kind: 'marketing',
      tenantSlug: null,
    });
    expect(inferPortalFromHost('admin.cleanscheduler.com.evil.com', 'cleanscheduler.com')).toEqual({
      kind: 'marketing',
      tenantSlug: null,
    });
  });

  it('classifies a single trailing dot the same as the host without it', () => {
    expect(inferPortalFromHost('admin.lvh.me.', 'lvh.me:3000')).toEqual({
      kind: 'admin',
      tenantSlug: null,
    });
    expect(inferPortalFromHost('my.lvh.me.', 'lvh.me')).toEqual({
      kind: 'customer',
      tenantSlug: null,
    });
    expect(inferPortalFromHost('acme.lvh.me.', 'lvh.me')).toEqual({
      kind: 'tenant',
      tenantSlug: 'acme',
    });
    expect(inferPortalFromHost('admin.evil.lvh.me.', 'lvh.me')).toEqual({
      kind: 'marketing',
      tenantSlug: null,
    });
  });
});
