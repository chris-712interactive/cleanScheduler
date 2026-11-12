import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const getUserById = vi.fn();
const updateUserById = vi.fn();
const inserts: string[] = [];
let closeError: { message: string } | null = null;
let auditError: { message: string } | null = null;

vi.mock('next/navigation', () => ({
  redirect: (url: string) => redirect(url),
}));

vi.mock('next/headers', () => ({
  headers: async () => ({
    get: (name: string) => (name === 'x-portal' ? 'tenant' : null),
  }),
}));

vi.mock('@/lib/auth/session', () => ({
  requireAuth: async () => ({
    user: { id: 'staff-1' },
    claims: { appRole: 'admin', masqueradeTargetTenantId: 'tenant-1' },
  }),
}));

vi.mock('@/lib/portal/publicOrigin', () => ({
  getPublicOrigin: () => 'http://admin.lvh.me:3000',
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from(table: string) {
      return {
        update() {
          return {
            eq() {
              return {
                is: async () => ({ error: closeError }),
              };
            },
          };
        },
        insert(payload: { action?: string }) {
          inserts.push(payload.action ?? table);
          return Promise.resolve({
            error: payload.action === 'masquerade.end' ? auditError : null,
          });
        },
      };
    },
    auth: {
      admin: {
        getUserById,
        updateUserById,
      },
    },
  }),
}));

import { endMasqueradeAction } from '@/lib/admin/masqueradeActions';

describe('endMasqueradeAction', () => {
  beforeEach(() => {
    closeError = null;
    auditError = null;
    inserts.length = 0;
    redirect.mockClear();
    getUserById.mockReset();
    updateUserById.mockReset();
    getUserById.mockResolvedValue({
      data: { user: { app_metadata: { app_role: 'admin' } } },
      error: null,
    });
    updateUserById.mockResolvedValue({ error: null });
  });

  it('surfaces a failed session close and does not record the end', async () => {
    closeError = { message: 'db down' };
    const result = await endMasqueradeAction({}, new FormData());
    expect(result).toEqual({ error: 'Support mode could not be closed. Try again.' });
    expect(inserts).not.toContain('masquerade.end');
    expect(updateUserById).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('surfaces a failed end audit or metadata clear after the session is closed', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    auditError = { message: 'audit down' };
    const auditResult = await endMasqueradeAction({}, new FormData());
    expect(auditResult).toEqual({
      error: 'Support mode was closed, but the end record or staff metadata could not be updated.',
    });
    expect(updateUserById).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalled();

    auditError = null;
    updateUserById.mockResolvedValue({ error: { message: 'metadata down' } });
    errorLog.mockClear();
    const metaResult = await endMasqueradeAction({}, new FormData());
    expect(metaResult.error).toMatch(/could not be updated/);
    expect(redirect).not.toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
