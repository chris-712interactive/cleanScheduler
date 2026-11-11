import type { User } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { extractClaims } from '@/lib/auth/types';

function user(partial: Pick<User, 'app_metadata' | 'user_metadata'>): User {
  return partial as User;
}

describe('extractClaims', () => {
  it('ignores user-editable app_role and masquerade target', () => {
    const claims = extractClaims(
      user({
        app_metadata: { app_role: 'employee', current_tenant_id: 'tenant-home' },
        user_metadata: {
          app_role: 'admin',
          masquerade_target_tenant_id: 'tenant-other',
          tenant_role: 'owner',
        },
      }),
    );

    expect(claims.appRole).toBe('employee');
    expect(claims.masqueradeTargetTenantId).toBeNull();
    expect(claims.tenantRole).toBe('owner');
    expect(claims.currentTenantId).toBe('tenant-home');
  });

  it('does not promote a user who only sets app_role in user_metadata', () => {
    const claims = extractClaims(
      user({
        app_metadata: {},
        user_metadata: { app_role: 'super_admin', masquerade_target_tenant_id: 'tenant-other' },
      }),
    );

    expect(claims.appRole).toBeNull();
    expect(claims.masqueradeTargetTenantId).toBeNull();
  });

  it('still reads platform role and masquerade from app_metadata', () => {
    const claims = extractClaims(
      user({
        app_metadata: {
          app_role: 'admin',
          masquerade_target_tenant_id: 'tenant-support',
        },
        user_metadata: {},
      }),
    );

    expect(claims.appRole).toBe('admin');
    expect(claims.masqueradeTargetTenantId).toBe('tenant-support');
  });
});
