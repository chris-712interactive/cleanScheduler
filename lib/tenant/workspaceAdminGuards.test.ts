import { describe, expect, it, vi } from 'vitest';
import {
  assertActiveAdministratorRemains,
  assertTeamRecoveryAccessRemains,
  isAdministratorRole,
} from '@/lib/tenant/workspaceAdminGuards';

describe('isAdministratorRole', () => {
  it('treats owner and admin as administrators', () => {
    expect(isAdministratorRole('owner')).toBe(true);
    expect(isAdministratorRole('admin')).toBe(true);
    expect(isAdministratorRole('employee')).toBe(false);
  });
});

describe('assertActiveAdministratorRemains', () => {
  it('blocks removing the last active administrator', async () => {
    const admin = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                neq: vi.fn(async () => ({ count: 0, error: null })),
              })),
            })),
          })),
        })),
      })),
    };

    const message = await assertActiveAdministratorRemains(
      admin as never,
      'tenant-1',
      'user-1',
      'admin',
    );
    expect(message).toMatch(/At least one active owner or admin/);
  });

  it('allows changing non-administrator roles', async () => {
    const message = await assertActiveAdministratorRemains(
      {} as never,
      'tenant-1',
      'user-1',
      'employee',
    );
    expect(message).toBeNull();
  });
});

describe('assertTeamRecoveryAccessRemains', () => {
  it('blocks removing the last team.manage_members grant', async () => {
    const adminRoleId = 'role-admin';
    const admin = {
      from: vi.fn((table: string) => {
        if (table === 'tenant_roles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [{ id: adminRoleId }], error: null })),
            })),
          };
        }
        if (table === 'tenant_role_permissions') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [{ role_id: adminRoleId, permission_key: 'team.manage_members' }],
                error: null,
              })),
            })),
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({
                data: [{ role_id: adminRoleId }],
                error: null,
              })),
            })),
          })),
        };
      }),
    };

    const message = await assertTeamRecoveryAccessRemains(admin as never, 'tenant-1', adminRoleId, [
      'quotes.view',
    ]);
    expect(message).toMatch(/team management access/);
  });
});
