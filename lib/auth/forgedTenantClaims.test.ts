import type { User } from '@supabase/supabase-js';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { decideTenantPortalAdmission } from '@/lib/auth/tenantPortalAdmission';
import { hasMinimumTenantRole, tenantRoleError } from '@/lib/auth/tenantRoleAccess';
import { extractClaims } from '@/lib/auth/types';

const HOME = 'tenant-home';
const OTHER = 'tenant-other';

const membershipRows = vi.hoisted(() => ({
  rows: [] as Array<{
    tenant_id: string;
    created_at?: string;
    tenants: { slug: string };
  }>,
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from(table: string) {
      if (table !== 'tenant_memberships') {
        throw new Error(`unexpected table ${table}`);
      }
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
        then(
          onFulfilled: (value: { data: typeof membershipRows.rows; error: null }) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) {
          return Promise.resolve({ data: membershipRows.rows, error: null }).then(
            onFulfilled,
            onRejected,
          );
        },
      };
      return builder;
    },
  }),
}));

import { resolvePostLoginDestinationForUser } from '@/lib/auth/resolvePostLoginDestination';

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_ENV = process.env.NEXT_PUBLIC_APP_ENV ?? 'local';
  process.env.NEXT_PUBLIC_APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'lvh.me:3000';
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';
});

function authUser(input: {
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}): User {
  return {
    id: 'user-1',
    app_metadata: input.app_metadata ?? {},
    user_metadata: input.user_metadata ?? {},
  } as User;
}

const forgedOtherOwner = {
  current_tenant_id: OTHER,
  tenant_role: 'owner',
};

describe('forged user_metadata tenant claims', () => {
  beforeEach(() => {
    membershipRows.rows = [{ tenant_id: HOME, tenants: { slug: 'home' } }];
  });

  it('does not change the post-login redirect or grant the forged workspace', async () => {
    const base = authUser({
      app_metadata: { app_role: 'employee', current_tenant_id: HOME, tenant_role: 'viewer' },
    });
    const forged = authUser({
      app_metadata: { app_role: 'employee', current_tenant_id: HOME, tenant_role: 'viewer' },
      user_metadata: forgedOtherOwner,
    });

    const clean = await resolvePostLoginDestinationForUser({
      user: base,
      nextPath: '/',
      currentOrigin: 'http://lvh.me:3000',
    });
    const attacked = await resolvePostLoginDestinationForUser({
      user: forged,
      nextPath: '/',
      currentOrigin: 'http://lvh.me:3000',
    });

    expect(attacked).toEqual(clean);
    expect(attacked.url).toBe('http://home.lvh.me:3000/');
    expect(attacked.url).not.toContain('other');
    expect(extractClaims(forged).currentTenantId).toBe(HOME);
    expect(extractClaims(forged).tenantRole).toBe('viewer');
    expect(extractClaims(forged).appRole).toBe('employee');
  });

  it('does not follow a forged current_tenant_id when app_metadata has none', async () => {
    membershipRows.rows = [
      { tenant_id: HOME, tenants: { slug: 'home' } },
      { tenant_id: OTHER, tenants: { slug: 'other' } },
    ];
    const clean = authUser({ app_metadata: { app_role: 'employee' } });
    const forged = authUser({
      app_metadata: { app_role: 'employee' },
      user_metadata: forgedOtherOwner,
    });

    const baseline = await resolvePostLoginDestinationForUser({
      user: clean,
      nextPath: '/',
      currentOrigin: 'http://lvh.me:3000',
    });
    const attacked = await resolvePostLoginDestinationForUser({
      user: forged,
      nextPath: '/',
      currentOrigin: 'http://lvh.me:3000',
    });

    expect(extractClaims(forged).currentTenantId).toBeNull();
    expect(extractClaims(forged).tenantRole).toBeNull();
    expect(attacked.url).toBe(baseline.url);
    expect(attacked.url).toBe('http://home.lvh.me:3000/');
    expect(attacked.kind).toBe('workspace');
  });

  it('falls back to the oldest membership, then tenant id, when the claim is missing or stale', async () => {
    membershipRows.rows = [
      { tenant_id: OTHER, created_at: '2024-06-01T00:00:00.000Z', tenants: { slug: 'other' } },
      { tenant_id: 'tenant-aaa', created_at: '2024-01-01T00:00:00.000Z', tenants: { slug: 'aaa' } },
      { tenant_id: HOME, created_at: '2024-01-01T00:00:00.000Z', tenants: { slug: 'home' } },
    ];
    const stale = authUser({
      app_metadata: { app_role: 'employee', current_tenant_id: 'tenant-removed' },
      user_metadata: { current_tenant_id: HOME, tenant_role: 'owner' },
    });

    const destination = await resolvePostLoginDestinationForUser({
      user: stale,
      nextPath: '/',
      currentOrigin: 'http://lvh.me:3000',
    });

    expect(destination.url).toBe('http://aaa.lvh.me:3000/');
  });

  it('does not prefer a second membership named only in user_metadata', async () => {
    membershipRows.rows = [
      { tenant_id: HOME, tenants: { slug: 'home' } },
      { tenant_id: OTHER, tenants: { slug: 'other' } },
    ];
    const base = authUser({
      app_metadata: { app_role: 'employee', current_tenant_id: HOME, tenant_role: 'employee' },
    });
    const forged = authUser({
      app_metadata: { app_role: 'employee', current_tenant_id: HOME, tenant_role: 'employee' },
      user_metadata: forgedOtherOwner,
    });

    const clean = await resolvePostLoginDestinationForUser({
      user: base,
      nextPath: '/',
      currentOrigin: 'http://lvh.me:3000',
    });
    const attacked = await resolvePostLoginDestinationForUser({
      user: forged,
      nextPath: '/',
      currentOrigin: 'http://lvh.me:3000',
    });

    expect(attacked.url).toBe(clean.url);
    expect(attacked.url).toBe('http://home.lvh.me:3000/');
  });

  it('keeps a host membership when user_metadata names a different tenant', async () => {
    membershipRows.rows = [
      { tenant_id: HOME, tenants: { slug: 'home' } },
      { tenant_id: OTHER, tenants: { slug: 'other' } },
    ];
    const forged = authUser({
      app_metadata: { app_role: 'employee', current_tenant_id: HOME, tenant_role: 'employee' },
      user_metadata: { current_tenant_id: 'tenant-third', tenant_role: 'owner' },
    });
    const clean = authUser({
      app_metadata: { app_role: 'employee', current_tenant_id: HOME, tenant_role: 'employee' },
    });

    const attacked = await resolvePostLoginDestinationForUser({
      user: forged,
      nextPath: '/',
      currentOrigin: 'http://other.lvh.me:3000',
    });
    const withoutForge = await resolvePostLoginDestinationForUser({
      user: clean,
      nextPath: '/',
      currentOrigin: 'http://other.lvh.me:3000',
    });

    expect(attacked.url).toBe(withoutForge.url);
    expect(attacked.url).toBe('http://other.lvh.me:3000/');
  });

  it('does not escalate a viewer membership because user_metadata says owner', () => {
    const forged = authUser({
      app_metadata: { app_role: 'employee', tenant_role: 'viewer', current_tenant_id: HOME },
      user_metadata: forgedOtherOwner,
    });
    const claims = extractClaims(forged);
    const membershipRole = 'viewer' as const;

    expect(claims.tenantRole).toBe('viewer');
    expect(claims.tenantRole).not.toBe('owner');
    expect(hasMinimumTenantRole(membershipRole, 'owner')).toBe(false);
    expect(hasMinimumTenantRole(membershipRole, 'admin')).toBe(false);
    expect(tenantRoleError(membershipRole, 'admin')).toMatch(/Admin/);
    expect(
      decideTenantPortalAdmission({
        appRole: claims.appRole,
        masqueradeTargetTenantId: claims.masqueradeTargetTenantId,
        hostTenantId: OTHER,
        hostTenantResolved: true,
        hasLiveMasqueradeSession: false,
      }),
    ).toEqual({ kind: 'deny', reason: 'membership' });
  });
});
