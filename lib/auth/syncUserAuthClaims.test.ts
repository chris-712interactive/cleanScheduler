import type { User } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { syncUserAuthClaims } from '@/lib/auth/syncUserAuthClaims';

function authAdmin(user: Pick<User, 'app_metadata' | 'user_metadata'>) {
  const updateUserById = vi.fn<
    (
      userId: string,
      body: { app_metadata: Record<string, unknown> },
    ) => Promise<{
      data: { user: typeof user };
      error: null;
    }>
  >(async () => ({
    data: { user },
    error: null,
  }));
  const admin = {
    auth: {
      admin: {
        getUserById: vi.fn(async () => ({ data: { user }, error: null })),
        updateUserById,
      },
    },
  };
  return { admin, updateUserById };
}

describe('syncUserAuthClaims platform role', () => {
  it('keeps Auth app_metadata and ignores a self-written profile or user_metadata role', async () => {
    const { admin, updateUserById } = authAdmin({
      app_metadata: { app_role: 'employee', current_tenant_id: 'tenant-home' },
      user_metadata: { app_role: 'super_admin' },
    });

    const next = await syncUserAuthClaims(admin as never, 'user-1', {
      appRole: 'super_admin',
      preservePlatformRoleFromAuth: true,
      tenantRole: 'admin',
      currentTenantId: 'tenant-home',
    });

    expect(next).toBe('employee');
    expect(updateUserById).toHaveBeenCalledWith('user-1', {
      app_metadata: {
        app_role: 'employee',
        current_tenant_id: 'tenant-home',
        tenant_role: 'admin',
      },
    });
  });

  it('preserves platform staff already stored in Auth app_metadata', async () => {
    const { admin, updateUserById } = authAdmin({
      app_metadata: { app_role: 'super_admin' },
      user_metadata: {},
    });

    const next = await syncUserAuthClaims(admin as never, 'user-1', {
      preservePlatformRoleFromAuth: true,
      tenantRole: 'employee',
      currentTenantId: 'tenant-home',
    });

    expect(next).toBe('super_admin');
    expect(updateUserById.mock.calls[0]?.[1]).toMatchObject({
      app_metadata: {
        app_role: 'super_admin',
        tenant_role: 'employee',
        current_tenant_id: 'tenant-home',
      },
    });
  });
});
