import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.fn((url: string) => {
  throw new Error(`REDIRECT:${url}`);
});
const getUserById = vi.fn();
const updateUserById = vi.fn();
const inserts: string[] = [];
let closeError: { message: string } | null = null;

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
          return Promise.resolve({ error: null });
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
});
