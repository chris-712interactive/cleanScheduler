const MARKER = /^qa-hosted-dev-[a-z0-9-]{1,48}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type QuoteProbeRow = {
  id?: string;
  tenant_id?: string;
  title?: string;
};

export type IsolationVerdict =
  { ok: true } | { ok: false; kind: 'blocked' | 'fail'; reason: string };

export function assertFixtureMarker(marker: string): void {
  if (!MARKER.test(marker)) {
    throw new Error('BLOCKED: RLS fixture marker must look like qa-hosted-dev-example.');
  }
}

export function assertTenantId(tenantId: string): void {
  if (!UUID.test(tenantId)) {
    throw new Error('BLOCKED: RLS tenant id is not a UUID.');
  }
}

export function quoteProbePath(filter: { title?: string; tenantId?: string }): string {
  if (!filter.title && !filter.tenantId) {
    throw new Error('BLOCKED: quote probe needs a marker or a tenant id.');
  }
  if (filter.title) assertFixtureMarker(filter.title);
  if (filter.tenantId) assertTenantId(filter.tenantId);
  const params = new URLSearchParams();
  params.set('select', filter.title ? 'id,tenant_id,title' : 'id,tenant_id');
  if (filter.title) params.set('title', `eq.${filter.title}`);
  if (filter.tenantId) params.set('tenant_id', `eq.${filter.tenantId}`);
  params.set('limit', '5');
  return `/rest/v1/tenant_quotes?${params.toString()}`;
}

function rowsOf(value: unknown): QuoteProbeRow[] | IsolationVerdict {
  if (!Array.isArray(value)) {
    return { ok: false, kind: 'fail', reason: 'Quote probe did not return a row list.' };
  }
  return value.filter((row): row is QuoteProbeRow => !!row && typeof row === 'object');
}

export function assertViewerIsolation(input: {
  viewer: 'A' | 'B';
  ownRows: unknown;
  foreignMarkerRows: unknown;
  foreignTenantRows: unknown;
  ownTenantId: string;
  ownMarker: string;
}): IsolationVerdict {
  const own = rowsOf(input.ownRows);
  if (!Array.isArray(own)) return own;
  const foreignMarker = rowsOf(input.foreignMarkerRows);
  if (!Array.isArray(foreignMarker)) return foreignMarker;
  const foreignTenant = rowsOf(input.foreignTenantRows);
  if (!Array.isArray(foreignTenant)) return foreignTenant;

  if (own.length === 0) {
    return {
      ok: false,
      kind: 'blocked',
      reason: `Fixture quote ${input.ownMarker} was not visible to viewer ${input.viewer}. Add that dev-only quote on the viewer's tenant before treating RLS as covered.`,
    };
  }
  if (own.some((row) => row.tenant_id !== input.ownTenantId || row.title !== input.ownMarker)) {
    return {
      ok: false,
      kind: 'fail',
      reason: `Viewer ${input.viewer} saw a quote outside its own fixture.`,
    };
  }
  if (foreignMarker.length > 0 || foreignTenant.length > 0) {
    return {
      ok: false,
      kind: 'fail',
      reason: `Viewer ${input.viewer} can read quote rows from the other tenant (${foreignMarker.length} by marker, ${foreignTenant.length} by tenant).`,
    };
  }
  return { ok: true };
}
