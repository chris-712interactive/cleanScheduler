import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  updateUserById: vi.fn<
    (
      userId: string,
      body: { app_metadata?: Record<string, unknown> },
    ) => Promise<{ data: { user: null }; error: null }>
  >(async () => ({ data: { user: null }, error: null })),
  signOut: vi.fn(async () => ({ error: null })),
  getUserById: vi.fn(),
  activeMemberships: [] as Array<{ tenant_id: string; role: string; created_at: string }>,
  profileUpdates: [] as Array<Record<string, unknown>>,
  authUser: {
    id: 'user-2',
    app_metadata: {} as Record<string, unknown>,
    user_metadata: {} as Record<string, unknown>,
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

vi.mock('@/lib/auth/tenantAccess', () => ({
  requireTenantPortalAccess: async () => ({
    tenantId: 'tenant-current',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    role: 'owner',
    roleId: null,
  }),
}));

vi.mock('@/lib/auth/session', () => ({
  getAuthContext: async () => ({
    user: { id: 'actor-1' },
    claims: {
      appRole: 'employee',
      currentTenantId: null,
      tenantRole: 'owner',
      masqueradeTargetTenantId: null,
    },
  }),
}));

vi.mock('@/lib/tenant/resolveMembershipPermissions', () => ({
  resolveMembershipPermissions: async () => new Set(['team.manage_members']),
  assertPermission: () => {},
  permissionDeniedMessage: () => null,
}));

vi.mock('@/lib/audit/recordPlatformAuditEvent', () => ({
  recordPlatformAuditEvent: async () => {},
}));

vi.mock('@/lib/billing/entitlements', () => ({
  resolveTenantPlanTier: async () => 'pro',
}));

vi.mock('@/lib/billing/teamSeats', () => ({
  countTeamSeatUsage: async () => ({ office: 1, field: 1 }),
  assertCanAssignTeamSeat: () => {},
  teamSeatGateErrorMessage: () => null,
}));

vi.mock('@/lib/billing/tenantFeatureGate', () => ({
  assertFeatureEnabledForTier: () => {},
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from(table: string) {
      const state = { op: 'select' as 'select' | 'update' };
      const builder = {
        select() {
          state.op = 'select';
          return builder;
        },
        update(payload?: Record<string, unknown>) {
          state.op = 'update';
          if (table === 'user_profiles' && payload) harness.profileUpdates.push(payload);
          return builder;
        },
        eq() {
          return builder;
        },
        order() {
          return builder;
        },
        maybeSingle: async () => {
          if (table !== 'tenant_memberships') return { data: null, error: null };
          return { data: { role: 'employee', is_active: true }, error: null };
        },
        then(resolve: (value: unknown) => void, reject?: (reason: unknown) => void) {
          const result =
            state.op === 'update'
              ? { error: null }
              : { data: harness.activeMemberships, error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
    auth: {
      admin: {
        getUserById: harness.getUserById,
        updateUserById: harness.updateUserById,
        signOut: harness.signOut,
      },
    },
  }),
}));

import {
  setTenantMemberActiveAction,
  updateTenantMemberRoleAction,
} from '@/app/tenant/employees/employeeMemberActions';

function deactivateForm() {
  const form = new FormData();
  form.set('tenant_slug', 'acme');
  form.set('target_user_id', 'user-2');
  form.set('is_active', 'false');
  return form;
}

describe('setTenantMemberActiveAction claim clearing', () => {
  beforeEach(() => {
    harness.profileUpdates.length = 0;
    harness.updateUserById.mockClear();
    harness.signOut.mockClear();
    harness.getUserById.mockReset();
    harness.authUser = {
      id: 'user-2',
      app_metadata: {
        app_role: 'employee',
        current_tenant_id: 'tenant-current',
        tenant_role: 'employee',
      },
      user_metadata: {
        current_tenant_id: 'tenant-forged',
        tenant_role: 'owner',
        app_role: 'super_admin',
      },
    };
    harness.getUserById.mockImplementation(async () => ({
      data: { user: harness.authUser },
      error: null,
    }));
    harness.updateUserById.mockImplementation(async (_userId, body) => {
      const next = { ...(harness.authUser.app_metadata ?? {}) };
      for (const [key, value] of Object.entries(body.app_metadata ?? {})) {
        if (value == null) delete next[key];
        else next[key] = value;
      }
      harness.authUser = { ...harness.authUser, app_metadata: next };
      return { data: { user: null }, error: null };
    });
    harness.activeMemberships = [];
  });

  it('switches app_metadata to the oldest remaining membership', async () => {
    harness.activeMemberships = [
      { tenant_id: 'tenant-newer', role: 'admin', created_at: '2024-06-01T00:00:00.000Z' },
      { tenant_id: 'tenant-older', role: 'viewer', created_at: '2020-01-01T00:00:00.000Z' },
    ];

    const result = await setTenantMemberActiveAction({}, deactivateForm());

    expect(result).toEqual({ success: 'Member deactivated.' });
    expect(harness.signOut).toHaveBeenCalledWith('user-2', 'global');
    expect(harness.updateUserById).toHaveBeenCalledTimes(1);
    const [userId, body] = harness.updateUserById.mock.calls[0]!;
    expect(userId).toBe('user-2');
    expect(Object.keys(body)).toEqual(['app_metadata']);
    expect(body.app_metadata).toEqual({
      current_tenant_id: 'tenant-older',
      tenant_role: 'viewer',
    });
    expect(harness.authUser.app_metadata).toMatchObject({
      app_role: 'employee',
      current_tenant_id: 'tenant-older',
      tenant_role: 'viewer',
    });
    expect(harness.authUser.user_metadata).toMatchObject({ app_role: 'super_admin' });
  });

  it('leaves claims alone when the deactivated membership is not current', async () => {
    harness.authUser.app_metadata = {
      app_role: 'employee',
      current_tenant_id: 'tenant-other',
      tenant_role: 'admin',
    };
    harness.authUser.user_metadata = {
      current_tenant_id: 'tenant-current',
      tenant_role: 'owner',
    };
    harness.activeMemberships = [
      { tenant_id: 'tenant-other', role: 'admin', created_at: '2021-01-01T00:00:00.000Z' },
    ];

    const result = await setTenantMemberActiveAction({}, deactivateForm());

    expect(result).toEqual({ success: 'Member deactivated.' });
    expect(harness.updateUserById).not.toHaveBeenCalled();
    expect(harness.getUserById).toHaveBeenCalled();
  });

  it('clears both tenant claims when no active membership remains', async () => {
    harness.activeMemberships = [];

    const result = await setTenantMemberActiveAction({}, deactivateForm());

    expect(result).toEqual({ success: 'Member deactivated.' });
    const body = harness.updateUserById.mock.calls[0]?.[1];
    expect(Object.keys(body ?? {})).toEqual(['app_metadata']);
    expect(body?.app_metadata).toEqual({
      current_tenant_id: null,
      tenant_role: null,
    });
    expect(body).not.toHaveProperty('user_metadata');
    expect(harness.authUser.app_metadata).toEqual({ app_role: 'employee' });
    expect(harness.authUser.user_metadata).toMatchObject({
      current_tenant_id: 'tenant-forged',
      tenant_role: 'owner',
    });
  });

  it('reports a claim sync failure after the member is signed out', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    harness.activeMemberships = [];
    harness.getUserById.mockImplementation(async () => ({
      data: {
        user: {
          ...harness.authUser,
          app_metadata: {
            app_role: 'employee',
            current_tenant_id: 'tenant-stale',
            tenant_role: 'owner',
          },
        },
      },
      error: null,
    }));

    const result = await setTenantMemberActiveAction({}, deactivateForm());

    expect(result.success).toBeUndefined();
    expect(result.error).toMatch(/deactivated and signed out/i);
    expect(result.error).toMatch(/claims could not be updated/i);
    expect(harness.signOut).toHaveBeenCalledWith('user-2', 'global');
    expect(errorLog).toHaveBeenCalledWith(
      '[setTenantMemberActiveAction] tenant claims were not updated after deactivation',
      expect.stringMatching(/concurrent updates/),
    );
    errorLog.mockRestore();
  });
});

describe('updateTenantMemberRoleAction platform role', () => {
  beforeEach(() => {
    harness.updateUserById.mockClear();
    harness.getUserById.mockReset();
    harness.authUser = {
      id: 'user-2',
      app_metadata: {},
      user_metadata: { app_role: 'super_admin', tenant_role: 'owner' },
    };
    harness.getUserById.mockImplementation(async () => ({
      data: { user: harness.authUser },
      error: null,
    }));
    harness.updateUserById.mockImplementation(async (_userId, body) => {
      const next = { ...(harness.authUser.app_metadata ?? {}) };
      for (const [key, value] of Object.entries(body.app_metadata ?? {})) {
        if (value == null) delete next[key];
        else next[key] = value;
      }
      harness.authUser = { ...harness.authUser, app_metadata: next };
      return { data: { user: null }, error: null };
    });
    harness.activeMemberships = [
      { tenant_id: 'tenant-current', role: 'viewer', created_at: '2020-01-01T00:00:00.000Z' },
    ];
  });

  it('succeeds when Auth has no app_role and copies employee onto the profile', async () => {
    const form = new FormData();
    form.set('tenant_slug', 'acme');
    form.set('target_user_id', 'user-2');
    form.set('next_role', 'viewer');

    const result = await updateTenantMemberRoleAction({}, form);

    expect(result).toEqual({ success: 'Role updated.' });
    expect(harness.authUser.app_metadata).toEqual({
      current_tenant_id: 'tenant-current',
      tenant_role: 'viewer',
    });
    expect(harness.authUser.user_metadata).toEqual({
      app_role: 'super_admin',
      tenant_role: 'owner',
    });
    expect(harness.profileUpdates).toEqual([expect.objectContaining({ app_role: 'employee' })]);
  });
});
