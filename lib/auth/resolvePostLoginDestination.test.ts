import { beforeAll, describe, expect, it } from 'vitest';
import {
  classifyPostLoginHost,
  resolvePostLoginDestination,
} from '@/lib/auth/resolvePostLoginDestination';

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'local';
  process.env.NEXT_PUBLIC_APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'lvh.me:3000';
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';
});

describe('classifyPostLoginHost', () => {
  it('classifies apex, admin, my, and tenant hosts', () => {
    expect(classifyPostLoginHost('http://lvh.me:3000')).toEqual({
      kind: 'marketing',
      tenantSlug: null,
    });
    expect(classifyPostLoginHost('http://admin.lvh.me:3000')).toEqual({
      kind: 'admin',
      tenantSlug: null,
    });
    expect(classifyPostLoginHost('http://my.lvh.me:3000')).toEqual({
      kind: 'customer',
      tenantSlug: null,
    });
    expect(classifyPostLoginHost('http://acme.lvh.me:3000')).toEqual({
      kind: 'tenant',
      tenantSlug: 'acme',
    });
  });
});

describe('resolvePostLoginDestination', () => {
  const memberships = [{ tenantId: 't1', slug: 'acme' }];

  it('sends tenant members from marketing host to their workspace', () => {
    const result = resolvePostLoginDestination({
      appRole: 'admin',
      currentTenantId: 't1',
      memberships,
      nextPath: '/',
      currentOrigin: 'http://lvh.me:3000',
    });
    expect(result.kind).toBe('workspace');
    expect(result.url).toBe('http://acme.lvh.me:3000/');
    expect(result.ctaLabel).toBe('Go to your workspace');
  });

  it('preserves deep links on the member tenant host', () => {
    const result = resolvePostLoginDestination({
      appRole: 'admin',
      currentTenantId: 't1',
      memberships,
      nextPath: '/schedule',
      currentOrigin: 'http://acme.lvh.me:3000',
    });
    expect(result.url).toBe('http://acme.lvh.me:3000/schedule');
  });

  it('rewrites relative next from marketing to the tenant host', () => {
    const result = resolvePostLoginDestination({
      appRole: 'employee',
      currentTenantId: 't1',
      memberships,
      nextPath: '/schedule',
      currentOrigin: 'http://lvh.me:3000',
    });
    expect(result.url).toBe('http://acme.lvh.me:3000/schedule');
  });

  it('routes customers without membership to my portal', () => {
    const result = resolvePostLoginDestination({
      appRole: 'customer',
      currentTenantId: null,
      memberships: [],
      nextPath: '/',
      currentOrigin: 'http://acme.lvh.me:3000',
    });
    expect(result.kind).toBe('customer');
    expect(result.url).toBe('http://my.lvh.me:3000/');
    expect(result.ctaLabel).toBe('Open customer portal');
  });

  it('routes platform admins without membership to admin', () => {
    const result = resolvePostLoginDestination({
      appRole: 'super_admin',
      currentTenantId: null,
      memberships: [],
      nextPath: '/',
      currentOrigin: 'http://lvh.me:3000',
    });
    expect(result.kind).toBe('admin');
    expect(result.url).toBe('http://admin.lvh.me:3000/');
    expect(result.ctaLabel).toBe('Open admin');
  });

  it('prefers current_tenant_id when multiple memberships exist', () => {
    const result = resolvePostLoginDestination({
      appRole: 'admin',
      currentTenantId: 't2',
      memberships: [
        { tenantId: 't1', slug: 'first' },
        { tenantId: 't2', slug: 'second' },
      ],
      nextPath: '/',
      currentOrigin: 'http://lvh.me:3000',
    });
    expect(result.url).toBe('http://second.lvh.me:3000/');
  });

  it('uses white-label customer origin when provided', () => {
    const result = resolvePostLoginDestination({
      appRole: 'customer',
      currentTenantId: null,
      memberships: [],
      nextPath: '/',
      currentOrigin: 'http://lvh.me:3000',
      customerPortalOrigin: 'https://portal.acme-cleaning.com',
    });
    expect(result.url).toBe('https://portal.acme-cleaning.com/');
  });
});
