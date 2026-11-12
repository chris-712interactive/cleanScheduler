import { describe, expect, it } from 'vitest';
import { decideTenantPortalAdmission } from '@/lib/auth/tenantPortalAdmission';
import {
  liveMasqueradeSessionMatches,
  MASQUERADE_MAX_DURATION_MS,
  type MasqueradeSessionClock,
} from '@/lib/auth/masqueradeSession';

const STAFF = 'staff-user';
const HOST = 'tenant-commercial';
const OTHER = 'tenant-residential';
const NOW = Date.parse('2026-11-12T15:00:00.000Z');

function session(overrides: Partial<MasqueradeSessionClock> = {}): MasqueradeSessionClock {
  return {
    admin_user_id: STAFF,
    target_tenant_id: HOST,
    started_at: new Date(NOW - 5 * 60 * 1000).toISOString(),
    ended_at: null,
    ...overrides,
  };
}

describe('live masquerade session', () => {
  it('admits an open session for that staff user and target tenant', () => {
    expect(
      liveMasqueradeSessionMatches(session(), { userId: STAFF, tenantId: HOST, nowMs: NOW }),
    ).toBe(true);
    expect(
      decideTenantPortalAdmission({
        appRole: 'admin',
        masqueradeTargetTenantId: HOST,
        hostTenantId: HOST,
        hostTenantResolved: true,
        hasLiveMasqueradeSession: true,
      }),
    ).toEqual({ kind: 'masquerade' });
  });

  it('denies an expired session', () => {
    const expired = session({
      started_at: new Date(NOW - MASQUERADE_MAX_DURATION_MS - 1_000).toISOString(),
    });
    expect(
      liveMasqueradeSessionMatches(expired, { userId: STAFF, tenantId: HOST, nowMs: NOW }),
    ).toBe(false);
  });

  it('denies an ended session', () => {
    const ended = session({ ended_at: new Date(NOW - 60_000).toISOString() });
    expect(liveMasqueradeSessionMatches(ended, { userId: STAFF, tenantId: HOST, nowMs: NOW })).toBe(
      false,
    );
  });

  it('denies a session for a different tenant', () => {
    const other = session({ target_tenant_id: OTHER });
    expect(liveMasqueradeSessionMatches(other, { userId: STAFF, tenantId: HOST, nowMs: NOW })).toBe(
      false,
    );
    expect(
      decideTenantPortalAdmission({
        appRole: 'super_admin',
        masqueradeTargetTenantId: OTHER,
        hostTenantId: HOST,
        hostTenantResolved: true,
        hasLiveMasqueradeSession: false,
      }),
    ).toEqual({ kind: 'deny', reason: 'membership' });
  });

  it('denies app_metadata without any session', () => {
    expect(liveMasqueradeSessionMatches(null, { userId: STAFF, tenantId: HOST, nowMs: NOW })).toBe(
      false,
    );
    expect(
      decideTenantPortalAdmission({
        appRole: 'super_admin',
        masqueradeTargetTenantId: HOST,
        hostTenantId: HOST,
        hostTenantResolved: true,
        hasLiveMasqueradeSession: false,
      }),
    ).toEqual({ kind: 'deny', reason: 'membership' });
  });
});
