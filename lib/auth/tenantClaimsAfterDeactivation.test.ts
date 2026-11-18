import { describe, expect, it } from 'vitest';
import { tenantClaimsAfterDeactivation } from '@/lib/auth/tenantClaimsAfterDeactivation';

const older = {
  tenantId: 'tenant-older',
  role: 'viewer' as const,
  createdAt: '2020-01-01T00:00:00.000Z',
};
const newer = {
  tenantId: 'tenant-newer',
  role: 'admin' as const,
  createdAt: '2024-06-01T00:00:00.000Z',
};

describe('tenantClaimsAfterDeactivation', () => {
  it('switches to the oldest remaining membership when the current tenant is deactivated', () => {
    expect(
      tenantClaimsAfterDeactivation({
        deactivatedTenantId: 'tenant-current',
        currentTenantId: 'tenant-current',
        activeMemberships: [newer, older],
      }),
    ).toEqual({ action: 'switch', tenantId: 'tenant-older', tenantRole: 'viewer' });
  });

  it('breaks equal timestamps by tenant id', () => {
    expect(
      tenantClaimsAfterDeactivation({
        deactivatedTenantId: 'tenant-current',
        currentTenantId: 'tenant-current',
        activeMemberships: [
          { tenantId: 'tenant-b', role: 'employee', createdAt: '2021-01-01T00:00:00.000Z' },
          { tenantId: 'tenant-a', role: 'owner', createdAt: '2021-01-01T00:00:00.000Z' },
        ],
      }),
    ).toEqual({ action: 'switch', tenantId: 'tenant-a', tenantRole: 'owner' });
  });

  it('leaves claims alone when a different tenant is current', () => {
    expect(
      tenantClaimsAfterDeactivation({
        deactivatedTenantId: 'tenant-current',
        currentTenantId: 'tenant-newer',
        activeMemberships: [older, newer],
      }),
    ).toEqual({ action: 'leave' });
  });

  it('clears claims only when no active membership remains', () => {
    expect(
      tenantClaimsAfterDeactivation({
        deactivatedTenantId: 'tenant-current',
        currentTenantId: 'tenant-current',
        activeMemberships: [],
      }),
    ).toEqual({ action: 'clear' });
    expect(
      tenantClaimsAfterDeactivation({
        deactivatedTenantId: 'tenant-current',
        currentTenantId: 'tenant-stale',
        activeMemberships: [
          { tenantId: 'tenant-current', role: 'employee', createdAt: '2022-01-01T00:00:00.000Z' },
        ],
      }),
    ).toEqual({ action: 'clear' });
  });
});
