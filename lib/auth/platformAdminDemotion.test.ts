import { describe, expect, it } from 'vitest';
import {
  demoteAuthAppRole,
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

  it('demotes tenant members labeled super_admin or sales when they are not allowlisted', () => {
    const allowlist = parseStaffAllowlist(STAFF);
    if (!allowlist) throw new Error('Expected a staff allowlist.');
    expect(
      shouldDemoteMislabeledPlatformAdmin({
        appRole: 'super_admin',
        hasTenantMembership: true,
        userId: TENANT_USER,
        allowlist,
      }),
    ).toBe(true);
    expect(
      shouldDemoteMislabeledPlatformAdmin({
        appRole: 'sales',
        hasTenantMembership: true,
        userId: TENANT_USER,
        allowlist,
      }),
    ).toBe(true);
  });

  it('clears a mislabeled profile even when Auth uses an unrecognized role', () => {
    expect(demoteAuthAppRole('super_admin')).toEqual({
      nextAuthRole: 'employee',
      authRoleUnrecognized: false,
    });
    expect(demoteAuthAppRole('admin')).toEqual({
      nextAuthRole: 'employee',
      authRoleUnrecognized: false,
    });
    expect(demoteAuthAppRole('sales')).toEqual({
      nextAuthRole: 'employee',
      authRoleUnrecognized: false,
    });
    expect(demoteAuthAppRole('owner')).toEqual({
      nextAuthRole: null,
      authRoleUnrecognized: true,
    });
    expect(demoteAuthAppRole('employee')).toEqual({
      nextAuthRole: null,
      authRoleUnrecognized: false,
    });
    expect(demoteAuthAppRole('customer')).toEqual({
      nextAuthRole: null,
      authRoleUnrecognized: false,
    });
    expect(demoteAuthAppRole(null)).toEqual({
      nextAuthRole: null,
      authRoleUnrecognized: false,
    });
    expect(demoteAuthAppRole('')).toEqual({
      nextAuthRole: null,
      authRoleUnrecognized: false,
    });
  });

  it('keeps allowlisted staff and platform labels with no membership', () => {
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
        userId: STAFF,
        allowlist,
      }),
    ).toBe(false);
    expect(
      shouldDemoteMislabeledPlatformAdmin({
        appRole: 'sales',
        hasTenantMembership: false,
        userId: TENANT_USER,
        allowlist,
      }),
    ).toBe(false);
    expect(
      shouldDemoteMislabeledPlatformAdmin({
        appRole: 'super_admin',
        hasTenantMembership: false,
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
