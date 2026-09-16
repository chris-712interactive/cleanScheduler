import { describe, expect, it } from 'vitest';
import {
  classifyAdminTenantSearchQuery,
  parseAdminTenantSearchQuery,
} from '@/lib/admin/searchAdminTenants';

describe('parseAdminTenantSearchQuery', () => {
  it('trims and caps length', () => {
    expect(parseAdminTenantSearchQuery('  acct_123  ')).toBe('acct_123');
    expect(parseAdminTenantSearchQuery('x'.repeat(300)).length).toBe(200);
  });
});

describe('classifyAdminTenantSearchQuery', () => {
  it('detects Connect account IDs', () => {
    expect(classifyAdminTenantSearchQuery('acct_1A2B3C')).toBe('connect_account');
  });

  it('detects platform customer and subscription IDs', () => {
    expect(classifyAdminTenantSearchQuery('cus_abc')).toBe('stripe_customer');
    expect(classifyAdminTenantSearchQuery('sub_xyz')).toBe('stripe_subscription');
  });

  it('detects tenant UUIDs', () => {
    expect(classifyAdminTenantSearchQuery('550e8400-e29b-41d4-a716-446655440000')).toBe(
      'tenant_id',
    );
  });

  it('falls back to slug/name search', () => {
    expect(classifyAdminTenantSearchQuery('acme-cleaning')).toBe('slug_or_name');
  });
});
