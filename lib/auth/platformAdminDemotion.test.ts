import { describe, expect, it } from 'vitest';
import {
  parseStaffAllowlist,
  shouldDemoteMislabeledPlatformAdmin,
} from '@/lib/auth/platformAdminDemotion';

const STAFF = '11111111-1111-4111-8111-111111111111';
const TENANT_USER = '22222222-2222-4222-8222-222222222222';

describe('platform admin demotion policy', () => {
  it('rejects a missing, empty, or invalid allowlist', () => {
    expect(parseStaffAllowlist(undefined)).toBeNull();
    expect(parseStaffAllowlist('')).toBeNull();
    expect(parseStaffAllowlist('   ')).toBeNull();
    expect(parseStaffAllowlist('not-a-user')).toBeNull();
    expect(parseStaffAllowlist(`${STAFF},owner`)).toBeNull();
  });

  it('parses staff user ids and ignores surrounding space', () => {
    const allowlist = parseStaffAllowlist(` ${STAFF.toUpperCase()} , ${TENANT_USER} `);
    expect(allowlist).toEqual(new Set([STAFF, TENANT_USER]));
  });

  it('demotes a tenant member labeled platform admin who is not allowlisted', () => {
    const allowlist = parseStaffAllowlist(STAFF);
    if (!allowlist) throw new Error('Expected a staff allowlist.');
    expect(
      shouldDemoteMislabeledPlatformAdmin({
        appRole: 'admin',
        hasTenantMembership: true,
        userId: TENANT_USER,
        allowlist,
      }),
    ).toBe(true);
  });

  it('keeps allowlisted staff, super admins, sales, and admins with no membership', () => {
    const allowlist = parseStaffAllowlist(STAFF);
    if (!allowlist) throw new Error('Expected a staff allowlist.');
    expect(
      shouldDemoteMislabeledPlatformAdmin({
        appRole: 'admin',
        hasTenantMembership: true,
        userId: STAFF,
        allowlist,
      }),
    ).toBe(false);
    expect(
      shouldDemoteMislabeledPlatformAdmin({
        appRole: 'super_admin',
        hasTenantMembership: true,
        userId: TENANT_USER,
        allowlist,
      }),
    ).toBe(false);
    expect(
      shouldDemoteMislabeledPlatformAdmin({
        appRole: 'sales',
        hasTenantMembership: true,
        userId: TENANT_USER,
        allowlist,
      }),
    ).toBe(false);
    expect(
      shouldDemoteMislabeledPlatformAdmin({
        appRole: 'admin',
        hasTenantMembership: false,
        userId: TENANT_USER,
        allowlist,
      }),
    ).toBe(false);
    expect(
      shouldDemoteMislabeledPlatformAdmin({
        appRole: 'admin',
        hasTenantMembership: true,
        userId: TENANT_USER,
        allowlist: new Set(),
      }),
    ).toBe(false);
  });
});
