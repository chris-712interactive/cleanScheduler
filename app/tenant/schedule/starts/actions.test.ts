import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  plan: 'pro' as 'pro' | 'business' | 'starter' | 'trial',
  userId: 'actor-1' as string | null,
  actorRole: 'owner' as string | null,
  actorError: null as { message: string; code?: string } | null,
  existing: {
    id: 'place-1',
    address_line1: '12 Shed Road',
    city: 'Asheville' as string | null,
    state: 'NC' as string | null,
    postal_code: '28801' as string | null,
  } as null | {
    id: string;
    address_line1: string;
    city: string | null;
    state: string | null;
    postal_code: string | null;
  },
  loadError: null as { message: string; code?: string } | null,
  writeError: null as { message: string; code?: string } | null,
  updates: [] as Array<Record<string, unknown>>,
  tables: [] as string[],
  geocode: vi.fn(async () => ({
    latitude: 35.6,
    longitude: -82.55,
    geocode_status: 'ok' as const,
    geocode_reason: null,
    geocode_source: 'census' as const,
    geocode_accuracy: 'address:L',
    geocoded_at: '2026-11-20T00:00:00.000Z',
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: () => {},
}));

vi.mock('@/lib/auth/tenantAccess', () => ({
  requireTenantPortalAccess: async () => ({
    tenantId: 'tenant-current',
    tenantSlug: 'acme',
    tenantName: 'Acme',
    role: 'owner',
    roleId: null,
  }),
}));

vi.mock('@/lib/auth/session', () => ({
  getAuthContext: async () => (harness.userId ? { user: { id: harness.userId } } : null),
}));

vi.mock('@/lib/billing/entitlements', () => ({
  featureUpgradeMessage: () =>
    'This feature is included in the Pro plan. Upgrade your plan to use it.',
  isFeatureEnabled: () => harness.plan === 'pro',
  resolveTenantEntitlementPlan: async () => harness.plan,
}));

vi.mock('@/lib/geo/ensurePropertyGeocoded', () => ({
  geocodeColumnsForAddress: harness.geocode,
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from(table: string) {
      harness.tables.push(table);
      const state: { payload: Record<string, unknown> | null } = { payload: null };
      const builder = {
        select() {
          return builder;
        },
        update(payload: Record<string, unknown>) {
          state.payload = payload;
          if (table === 'tenant_route_locations') harness.updates.push(payload);
          return builder;
        },
        eq() {
          return builder;
        },
        maybeSingle: async () => {
          if (table === 'tenant_memberships') {
            return {
              data: harness.actorRole ? { role: harness.actorRole } : null,
              error: harness.actorError,
            };
          }
          return { data: harness.existing, error: harness.loadError };
        },
        then(resolve: (value: unknown) => void, reject?: (reason: unknown) => void) {
          const result = state.payload
            ? {
                data: harness.writeError ? null : [{ id: harness.existing?.id ?? 'place-1' }],
                error: harness.writeError,
              }
            : { data: null, error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
  }),
}));

import { updateRouteLocationAction } from '@/app/tenant/schedule/starts/actions';

function placeForm(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    tenant_slug: 'acme',
    location_id: 'place-1',
    label: 'South shed',
    address_line1: '12 Shed Road',
    city: 'Asheville',
    state: 'NC',
    postal_code: '28801',
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('updateRouteLocationAction', () => {
  beforeEach(() => {
    harness.plan = 'pro';
    harness.userId = 'actor-1';
    harness.actorRole = 'owner';
    harness.actorError = null;
    harness.existing = {
      id: 'place-1',
      address_line1: '12 Shed Road',
      city: 'Asheville',
      state: 'NC',
      postal_code: '28801',
    };
    harness.loadError = null;
    harness.writeError = null;
    harness.updates.length = 0;
    harness.tables.length = 0;
    harness.geocode.mockClear();
    harness.geocode.mockImplementation(async () => ({
      latitude: 35.6,
      longitude: -82.55,
      geocode_status: 'ok' as const,
      geocode_reason: null,
      geocode_source: 'census' as const,
      geocode_accuracy: 'address:L',
      geocoded_at: '2026-11-20T00:00:00.000Z',
    }));
  });

  it('asks for a place, a name, and a street before it writes', async () => {
    await expect(updateRouteLocationAction({}, placeForm({ location_id: '' }))).resolves.toEqual({
      error: 'Choose a place to edit.',
    });
    await expect(updateRouteLocationAction({}, placeForm({ label: '   ' }))).resolves.toEqual({
      error: 'Enter a name and a street address.',
    });
    await expect(updateRouteLocationAction({}, placeForm({ address_line1: '' }))).resolves.toEqual({
      error: 'Enter a name and a street address.',
    });
    await expect(
      updateRouteLocationAction({}, placeForm({ label: 'n'.repeat(81) })),
    ).resolves.toEqual({ error: 'Use a shorter name.' });
    await expect(
      updateRouteLocationAction({}, placeForm({ address_line1: 's'.repeat(201) })),
    ).resolves.toEqual({ error: 'Use a shorter street address.' });
    expect(harness.geocode).not.toHaveBeenCalled();
    expect(harness.updates).toEqual([]);
  });

  it('keeps the office and Pro gates', async () => {
    harness.actorRole = 'employee';
    await expect(updateRouteLocationAction({}, placeForm())).resolves.toEqual({
      error: 'Only the office can set start locations.',
    });

    harness.actorRole = 'admin';
    harness.plan = 'business';
    await expect(updateRouteLocationAction({}, placeForm())).resolves.toEqual({
      error: 'This feature is included in the Pro plan. Upgrade your plan to use it.',
    });
    expect(harness.updates).toEqual([]);
  });

  it('rejects a place that is not on this workspace', async () => {
    harness.existing = null;
    await expect(updateRouteLocationAction({}, placeForm())).resolves.toEqual({
      error: 'That place is not on this workspace.',
    });
    expect(harness.geocode).not.toHaveBeenCalled();
    expect(harness.tables).not.toContain('tenant_cleaner_route_bases');
  });

  it('keeps the duplicate-name check', async () => {
    harness.writeError = { message: 'duplicate', code: '23505' };
    await expect(
      updateRouteLocationAction({}, placeForm({ label: 'North barn' })),
    ).resolves.toEqual({ error: 'That name is already used.' });
    expect(harness.geocode).not.toHaveBeenCalled();
  });

  it('renames a place without looking the address up again', async () => {
    await expect(
      updateRouteLocationAction({}, placeForm({ label: '  North shed  ' })),
    ).resolves.toEqual({ success: 'Start location updated.' });
    expect(harness.geocode).not.toHaveBeenCalled();
    expect(harness.updates).toEqual([
      {
        label: 'North shed',
        address_line1: '12 Shed Road',
        city: 'Asheville',
        state: 'NC',
        postal_code: '28801',
      },
    ]);
    expect(harness.tables).not.toContain('tenant_cleaner_route_bases');
  });

  it('looks up a changed address and leaves the place id alone', async () => {
    await expect(
      updateRouteLocationAction({}, placeForm({ address_line1: ' 44 New Shed Road ' })),
    ).resolves.toEqual({ success: 'Start location updated.' });
    expect(harness.geocode).toHaveBeenCalledTimes(1);
    expect(harness.geocode).toHaveBeenCalledWith({
      line1: '44 New Shed Road',
      city: 'Asheville',
      state: 'NC',
      postalCode: '28801',
    });
    expect(harness.updates[0]).toEqual({
      label: 'South shed',
      address_line1: '44 New Shed Road',
      city: 'Asheville',
      state: 'NC',
      postal_code: '28801',
      latitude: 35.6,
      longitude: -82.55,
      geocode_status: 'ok',
      geocode_reason: null,
    });
    expect(harness.updates[0]).not.toHaveProperty('geocode_source');
    expect(harness.tables).not.toContain('tenant_cleaner_route_bases');
  });

  it('treats spacing and letter case as the same address', async () => {
    await expect(
      updateRouteLocationAction({}, placeForm({ address_line1: '12  shed   road' })),
    ).resolves.toEqual({ success: 'Start location updated.' });
    expect(harness.geocode).not.toHaveBeenCalled();
    expect(harness.updates[0]?.address_line1).toBe('12  shed   road');
    expect(harness.updates[0]).not.toHaveProperty('latitude');
  });

  it('still saves when the new address cannot be looked up', async () => {
    harness.geocode.mockRejectedValueOnce(new Error('census down'));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      updateRouteLocationAction({}, placeForm({ city: 'Weaverville' })),
    ).resolves.toEqual({ success: 'Start location updated.' });
    expect(harness.updates[0]).toMatchObject({
      city: 'Weaverville',
      latitude: null,
      longitude: null,
      geocode_status: 'pending',
      geocode_reason: null,
    });
    errors.mockRestore();
  });
});
