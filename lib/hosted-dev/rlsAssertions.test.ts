import { describe, expect, it } from 'vitest';
import {
  assertFixtureMarker,
  assertViewerIsolation,
  quoteProbePath,
} from '@/lib/hosted-dev/rlsAssertions';

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';

describe('cross-tenant quote assertions', () => {
  it('selects only ids and the fixture title', () => {
    const path = quoteProbePath({ title: 'qa-hosted-dev-a', tenantId: tenantA });
    expect(path).toContain('select=id%2Ctenant_id%2Ctitle');
    expect(path).not.toContain('notes');
    expect(path).not.toContain('select=*');
    expect(() => quoteProbePath({ title: 'Jane Customer' })).toThrow(/BLOCKED/);
  });

  it('passes only when each viewer sees its marker and nothing from the other tenant', () => {
    expect(
      assertViewerIsolation({
        viewer: 'A',
        ownRows: [{ id: '1', tenant_id: tenantA, title: 'qa-hosted-dev-a' }],
        foreignMarkerRows: [],
        foreignTenantRows: [],
        ownTenantId: tenantA,
        ownMarker: 'qa-hosted-dev-a',
      }),
    ).toEqual({ ok: true });
  });

  it('blocks a missing fixture and fails a cross-tenant read', () => {
    expect(
      assertViewerIsolation({
        viewer: 'A',
        ownRows: [],
        foreignMarkerRows: [],
        foreignTenantRows: [],
        ownTenantId: tenantA,
        ownMarker: 'qa-hosted-dev-a',
      }).ok,
    ).toBe(false);
    const leaked = assertViewerIsolation({
      viewer: 'B',
      ownRows: [{ id: '2', tenant_id: tenantB, title: 'qa-hosted-dev-b' }],
      foreignMarkerRows: [{ id: '1', tenant_id: tenantA, title: 'qa-hosted-dev-a' }],
      foreignTenantRows: [],
      ownTenantId: tenantB,
      ownMarker: 'qa-hosted-dev-b',
    });
    expect(leaked).toMatchObject({ ok: false, kind: 'fail' });
    expect(assertFixtureMarker('qa-hosted-dev-a')).toBeUndefined();
  });
});
