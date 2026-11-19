import type { User } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import {
  desiredTenantClaims,
  syncTenantClaimsFromMemberships,
} from '@/lib/auth/syncTenantClaimsFromMemberships';

type MembershipRow = {
  tenant_id: string;
  role: string;
  created_at: string;
  is_active: boolean;
};

type AuthState = {
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
};

/**
 * GoTrue merges `app_metadata` and deletes keys set to null. The first
 * `updateUserById` waits so a second sync can commit, then the first writer
 * applies the patch it computed before that commit.
 */
function racingAuth(initial: AuthState, memberships: MembershipRow[]) {
  const state: AuthState = {
    app_metadata: { ...initial.app_metadata },
    user_metadata: { ...initial.user_metadata },
  };
  const rows = memberships.map((row) => ({ ...row }));
  const patches: Array<Record<string, unknown>> = [];
  let heldWrite = false;
  let releaseHold: () => void = () => {};
  const hold = new Promise<void>((resolve) => {
    releaseHold = resolve;
  });
  let markHeld: () => void = () => {};
  const held = new Promise<void>((resolve) => {
    markHeld = resolve;
  });

  const admin = {
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        order() {
          return builder;
        },
        then(resolve: (value: unknown) => void, reject?: (reason: unknown) => void) {
          const data =
            table === 'tenant_memberships'
              ? rows.filter((row) => row.is_active).map((row) => ({ ...row }))
              : [];
          return Promise.resolve({ data, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
    auth: {
      admin: {
        getUserById: async () => ({
          data: {
            user: {
              id: 'user-1',
              app_metadata: { ...state.app_metadata },
              user_metadata: { ...state.user_metadata },
            } as Pick<User, 'id' | 'app_metadata' | 'user_metadata'>,
          },
          error: null,
        }),
        updateUserById: async (
          _userId: string,
          body: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> },
        ) => {
          if (!heldWrite) {
            heldWrite = true;
            markHeld();
            await hold;
          }
          const patch = { ...(body.app_metadata ?? {}) };
          patches.push(patch);
          if (body.user_metadata) {
            state.user_metadata = { ...state.user_metadata, ...body.user_metadata };
          }
          for (const [key, value] of Object.entries(patch)) {
            if (value == null) delete state.app_metadata[key];
            else state.app_metadata[key] = value;
          }
          return { data: { user: null }, error: null };
        },
      },
    },
  };

  return {
    admin,
    rows,
    state,
    patches,
    held,
    releaseHold,
  };
}

const forgedUserMetadata = {
  app_role: 'super_admin',
  current_tenant_id: 'tenant-forged',
  tenant_role: 'owner',
};

function expectClaimsMatchMemberships(state: AuthState, rows: MembershipRow[]) {
  const active = rows.filter((row) => row.is_active);
  const current = state.app_metadata.current_tenant_id;
  const role = state.app_metadata.tenant_role;
  if (active.length === 0) {
    expect(current).toBeUndefined();
    expect(role).toBeUndefined();
    return;
  }
  const match = active.find((row) => row.tenant_id === current);
  expect(match, `current tenant ${String(current)} is not an active membership`).toBeTruthy();
  expect(role).toBe(match?.role);
}

describe('desiredTenantClaims', () => {
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

  it('keeps an active current tenant and takes the role from that row', () => {
    expect(
      desiredTenantClaims({
        activeMemberships: [older, newer],
        currentTenantId: 'tenant-newer',
      }),
    ).toEqual({ currentTenantId: 'tenant-newer', tenantRole: 'admin' });
  });

  it('falls back to the oldest active membership when the current tenant is inactive', () => {
    expect(
      desiredTenantClaims({
        activeMemberships: [newer, older],
        currentTenantId: 'tenant-gone',
      }),
    ).toEqual({ currentTenantId: 'tenant-older', tenantRole: 'viewer' });
  });

  it('uses a preferred tenant for a role change, and only as fallback when asked', () => {
    expect(
      desiredTenantClaims({
        activeMemberships: [older, newer],
        currentTenantId: 'tenant-older',
        preferredTenantId: 'tenant-newer',
      }),
    ).toEqual({ currentTenantId: 'tenant-newer', tenantRole: 'admin' });
    expect(
      desiredTenantClaims({
        activeMemberships: [older, newer],
        currentTenantId: 'tenant-older',
        preferredTenantId: 'tenant-newer',
        preferTenantWhenCurrentInvalid: true,
      }),
    ).toEqual({ currentTenantId: 'tenant-older', tenantRole: 'viewer' });
    expect(
      desiredTenantClaims({
        activeMemberships: [older, newer],
        currentTenantId: null,
        preferredTenantId: 'tenant-newer',
        preferTenantWhenCurrentInvalid: true,
      }),
    ).toEqual({ currentTenantId: 'tenant-newer', tenantRole: 'admin' });
  });
});

describe('syncTenantClaimsFromMemberships platform role', () => {
  function quietAdmin(appMetadata: Record<string, unknown>, userMetadata: Record<string, unknown>) {
    const patches: Array<Record<string, unknown>> = [];
    const admin = {
      from() {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          order() {
            return builder;
          },
          then(resolve: (value: unknown) => void, reject?: (reason: unknown) => void) {
            return Promise.resolve({
              data: [
                {
                  tenant_id: 'tenant-b',
                  role: 'admin',
                  created_at: '2021-01-01T00:00:00.000Z',
                },
              ],
              error: null,
            }).then(resolve, reject);
          },
        };
        return builder;
      },
      auth: {
        admin: {
          getUserById: async () => ({
            data: {
              user: {
                id: 'user-1',
                app_metadata: { ...appMetadata },
                user_metadata: { ...userMetadata },
              },
            },
            error: null,
          }),
          updateUserById: async (
            _userId: string,
            body: { app_metadata?: Record<string, unknown> },
          ) => {
            const patch = { ...(body.app_metadata ?? {}) };
            patches.push(patch);
            for (const [key, value] of Object.entries(patch)) {
              if (value == null) delete appMetadata[key];
              else appMetadata[key] = value;
            }
            return { data: { user: null }, error: null };
          },
        },
      },
    };
    return { admin, patches, appMetadata };
  }

  it('stores employee when Auth has no platform role and ignores user_metadata', async () => {
    const { admin, patches, appMetadata } = quietAdmin(
      { current_tenant_id: 'tenant-b', tenant_role: 'admin' },
      { app_role: 'super_admin' },
    );
    const role = await syncTenantClaimsFromMemberships(admin as never, {
      userId: 'user-1',
      preferredTenantId: 'tenant-b',
      preservePlatformRoleFromAuth: true,
    });
    expect(role).toBe('employee');
    expect(patches).toEqual([]);
    expect(appMetadata).not.toHaveProperty('app_role');
  });

  it('stores employee when Auth app_role is customer', async () => {
    const { admin, patches } = quietAdmin(
      { app_role: 'customer', current_tenant_id: 'tenant-b', tenant_role: 'admin' },
      { app_role: 'super_admin' },
    );
    const role = await syncTenantClaimsFromMemberships(admin as never, {
      userId: 'user-1',
      preservePlatformRoleFromAuth: true,
    });
    expect(role).toBe('employee');
    expect(patches.every((patch) => !Object.prototype.hasOwnProperty.call(patch, 'app_role'))).toBe(
      true,
    );
  });

  it('keeps platform staff already stored in Auth app_metadata', async () => {
    const { admin } = quietAdmin(
      { app_role: 'super_admin', current_tenant_id: 'tenant-b', tenant_role: 'admin' },
      {},
    );
    const role = await syncTenantClaimsFromMemberships(admin as never, {
      userId: 'user-1',
      preservePlatformRoleFromAuth: true,
    });
    expect(role).toBe('super_admin');
  });
});

describe('syncTenantClaimsFromMemberships concurrency', () => {
  it('keeps the added tenant when a deactivate clear lands after the add', async () => {
    const race = racingAuth(
      {
        app_metadata: {
          app_role: 'employee',
          current_tenant_id: 'tenant-a',
          tenant_role: 'employee',
          masquerade_target_tenant_id: 'masq-1',
        },
        user_metadata: forgedUserMetadata,
      },
      [
        {
          tenant_id: 'tenant-a',
          role: 'employee',
          created_at: '2020-01-01T00:00:00.000Z',
          is_active: false,
        },
      ],
    );

    const deactivate = syncTenantClaimsFromMemberships(race.admin as never, {
      userId: 'user-1',
      preservePlatformRoleFromAuth: true,
    });
    await race.held;

    race.rows.push({
      tenant_id: 'tenant-b',
      role: 'admin',
      created_at: '2024-06-01T00:00:00.000Z',
      is_active: true,
    });
    await syncTenantClaimsFromMemberships(race.admin as never, {
      userId: 'user-1',
      preferredTenantId: 'tenant-b',
      preservePlatformRoleFromAuth: true,
    });
    race.releaseHold();
    await deactivate;

    expectClaimsMatchMemberships(race.state, race.rows);
    expect(race.state.app_metadata).toMatchObject({
      app_role: 'employee',
      current_tenant_id: 'tenant-b',
      tenant_role: 'admin',
      masquerade_target_tenant_id: 'masq-1',
    });
    expect(race.state.user_metadata).toEqual(forgedUserMetadata);
    for (const patch of race.patches) {
      expect(patch).not.toHaveProperty('app_role');
      expect(patch).not.toHaveProperty('masquerade_target_tenant_id');
      expect(patch).not.toHaveProperty('user_metadata');
    }
  });

  it('keeps the role-change role when deactivation writes an older role last', async () => {
    const race = racingAuth(
      {
        app_metadata: {
          app_role: 'super_admin',
          current_tenant_id: 'tenant-a',
          tenant_role: 'employee',
          masquerade_target_tenant_id: 'masq-1',
        },
        user_metadata: forgedUserMetadata,
      },
      [
        {
          tenant_id: 'tenant-a',
          role: 'employee',
          created_at: '2019-01-01T00:00:00.000Z',
          is_active: false,
        },
        {
          tenant_id: 'tenant-b',
          role: 'employee',
          created_at: '2021-01-01T00:00:00.000Z',
          is_active: true,
        },
      ],
    );

    const deactivate = syncTenantClaimsFromMemberships(race.admin as never, {
      userId: 'user-1',
      preservePlatformRoleFromAuth: true,
    });
    await race.held;

    const roleRow = race.rows.find((row) => row.tenant_id === 'tenant-b');
    roleRow!.role = 'admin';
    await syncTenantClaimsFromMemberships(race.admin as never, {
      userId: 'user-1',
      preferredTenantId: 'tenant-b',
      preservePlatformRoleFromAuth: true,
    });
    race.releaseHold();
    await deactivate;

    expectClaimsMatchMemberships(race.state, race.rows);
    expect(race.state.app_metadata).toMatchObject({
      app_role: 'super_admin',
      current_tenant_id: 'tenant-b',
      tenant_role: 'admin',
      masquerade_target_tenant_id: 'masq-1',
    });
    expect(race.state.user_metadata).toEqual(forgedUserMetadata);
  });

  it('does not leave the current tenant on a membership deactivated by the other call', async () => {
    const race = racingAuth(
      {
        app_metadata: {
          app_role: 'employee',
          current_tenant_id: 'tenant-a',
          tenant_role: 'employee',
        },
        user_metadata: forgedUserMetadata,
      },
      [
        {
          tenant_id: 'tenant-a',
          role: 'employee',
          created_at: '2019-01-01T00:00:00.000Z',
          is_active: false,
        },
        {
          tenant_id: 'tenant-b',
          role: 'viewer',
          created_at: '2020-01-01T00:00:00.000Z',
          is_active: true,
        },
        {
          tenant_id: 'tenant-c',
          role: 'admin',
          created_at: '2022-01-01T00:00:00.000Z',
          is_active: true,
        },
      ],
    );

    const deactivateA = syncTenantClaimsFromMemberships(race.admin as never, {
      userId: 'user-1',
      preservePlatformRoleFromAuth: true,
    });
    await race.held;

    const tenantB = race.rows.find((row) => row.tenant_id === 'tenant-b');
    tenantB!.is_active = false;
    await syncTenantClaimsFromMemberships(race.admin as never, {
      userId: 'user-1',
      preservePlatformRoleFromAuth: true,
    });
    race.releaseHold();
    await deactivateA;

    expectClaimsMatchMemberships(race.state, race.rows);
    expect(race.state.app_metadata).toMatchObject({
      app_role: 'employee',
      current_tenant_id: 'tenant-c',
      tenant_role: 'admin',
    });
  });

  it('throws when every write is overwritten before the next read', async () => {
    const admin = {
      from() {
        const builder = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          order() {
            return builder;
          },
          then(resolve: (value: unknown) => void, reject?: (reason: unknown) => void) {
            return Promise.resolve({
              data: [
                {
                  tenant_id: 'tenant-b',
                  role: 'admin',
                  created_at: '2021-01-01T00:00:00.000Z',
                },
              ],
              error: null,
            }).then(resolve, reject);
          },
        };
        return builder;
      },
      auth: {
        admin: {
          getUserById: async () => ({
            data: {
              user: {
                app_metadata: {
                  app_role: 'employee',
                  current_tenant_id: 'tenant-stale',
                  tenant_role: 'owner',
                },
                user_metadata: {},
              },
            },
            error: null,
          }),
          updateUserById: async () => ({ data: { user: null }, error: null }),
        },
      },
    };

    await expect(
      syncTenantClaimsFromMemberships(admin as never, {
        userId: 'user-1',
        preservePlatformRoleFromAuth: true,
      }),
    ).rejects.toThrow(/concurrent updates/);
  });
});
