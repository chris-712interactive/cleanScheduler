import { describe, expect, it } from 'vitest';
import { decideTenantPortalAdmission } from '@/lib/auth/tenantPortalAdmission';
import {
  clearedMasqueradeAppMetadata,
  liveMasqueradeSessionMatches,
  MASQUERADE_CLOCK_SKEW_MS,
  MASQUERADE_MAX_DURATION_MS,
  openMasqueradeSessionsPastTtl,
  shouldAuditMasqueradeTtlClose,
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

  it('does not treat a start beyond clock skew as live', () => {
    const future = session({
      started_at: new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(
      liveMasqueradeSessionMatches(future, { userId: STAFF, tenantId: HOST, nowMs: NOW }),
    ).toBe(false);
    const withinSkew = session({
      started_at: new Date(NOW + MASQUERADE_CLOCK_SKEW_MS - 1000).toISOString(),
    });
    expect(
      liveMasqueradeSessionMatches(withinSkew, { userId: STAFF, tenantId: HOST, nowMs: NOW }),
    ).toBe(true);
  });

  it('sets masquerade claims to null so a metadata merge drops them', () => {
    const payload = clearedMasqueradeAppMetadata({
      app_role: 'admin',
      masquerade_target_tenant_id: HOST,
      current_tenant_id: HOST,
    });
    expect(payload).toEqual({
      app_role: 'admin',
      masquerade_target_tenant_id: null,
      current_tenant_id: null,
    });
    expect(Object.prototype.hasOwnProperty.call(payload, 'masquerade_target_tenant_id')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(payload, 'current_tenant_id')).toBe(true);
  });

  it('selects every open row past the TTL, not only the newest', () => {
    const expiredA = session({
      target_tenant_id: HOST,
      started_at: new Date(NOW - MASQUERADE_MAX_DURATION_MS - 1).toISOString(),
    });
    const expiredOlder = session({
      target_tenant_id: OTHER,
      started_at: new Date(NOW - MASQUERADE_MAX_DURATION_MS - 60_000).toISOString(),
    });
    const liveB = session({
      target_tenant_id: OTHER,
      started_at: new Date(NOW - 60_000).toISOString(),
    });
    const future = session({
      started_at: new Date(NOW + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const past = openMasqueradeSessionsPastTtl(
      [
        { ...expiredA, id: 'a' },
        { ...expiredOlder, id: 'older' },
        { ...liveB, id: 'b' },
        { ...future, id: 'future' },
      ],
      NOW,
    );
    expect(past.map((row) => row.id)).toEqual(['a', 'older']);
  });

  it('audits a ttl close only when this update ended the row', () => {
    expect(shouldAuditMasqueradeTtlClose(['session-1'])).toBe(true);
    expect(shouldAuditMasqueradeTtlClose([])).toBe(false);
    expect(shouldAuditMasqueradeTtlClose(null)).toBe(false);
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
