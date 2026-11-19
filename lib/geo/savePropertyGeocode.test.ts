import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { propertyGeocodePatchFromResult } from './propertyGeocodePatch';
import { savePropertyGeocode } from './savePropertyGeocode';

const address = { line1: '1', city: '', state: 'NC', postalCode: '' };

function adminFor(result: { data: { id: string }[] | null; error: { message: string } | null }) {
  const query = {
    eq() {
      return query;
    },
    is() {
      return query;
    },
    select() {
      return query;
    },
    then(
      onFulfilled: (value: typeof result) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
  };
  return {
    from() {
      return {
        update() {
          return query;
        },
      };
    },
  } as unknown as SupabaseClient<Database>;
}

describe('savePropertyGeocode', () => {
  it('returns the patch only after a row is updated', async () => {
    const saved = await savePropertyGeocode(adminFor({ data: [{ id: 'property' }], error: null }), {
      tenantId: 'tenant',
      propertyId: 'property',
      address,
    });
    expect(saved).toMatchObject({
      latitude: null,
      longitude: null,
      geocode_reason: 'incomplete',
      geocode_status: 'failed',
    });
  });

  it('returns null when the update errors or matches no row', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const errored = await savePropertyGeocode(
      adminFor({ data: null, error: { message: 'permission denied' } }),
      { tenantId: 'tenant', propertyId: 'property', address },
    );
    const missed = await savePropertyGeocode(adminFor({ data: [], error: null }), {
      tenantId: 'tenant',
      propertyId: 'property',
      address,
    });
    errorSpy.mockRestore();
    expect(errored).toBeNull();
    expect(missed).toBeNull();
  });
});

describe('propertyGeocodePatchFromResult', () => {
  it('keeps an outage pending instead of a finished failure', () => {
    expect(
      propertyGeocodePatchFromResult(
        {
          point: null,
          reason: 'lookup_failed',
          status: 'failed',
          source: null,
          accuracy: null,
          reused: false,
        },
        '2026-04-01T00:00:00.000Z',
      ),
    ).toMatchObject({
      geocode_status: 'pending',
      geocode_reason: 'lookup_failed',
      geocoded_at: '2026-04-01T00:00:00.000Z',
      latitude: null,
    });
  });
});
