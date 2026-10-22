import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

vi.mock('@/lib/geo/censusGeocode', () => ({
  lookupUsAddress: vi.fn(),
}));

import { lookupUsAddress } from '@/lib/geo/censusGeocode';
import { ensurePropertyGeocoded } from '@/lib/geo/ensurePropertyGeocoded';

const lookup = vi.mocked(lookupUsAddress);

type PropertyRow = {
  address_line1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
};

function adminFor(row: PropertyRow | null) {
  const updates: Array<Record<string, unknown>> = [];
  const admin = {
    from() {
      return {
        select() {
          const query = {
            eq() {
              return query;
            },
            maybeSingle: async () => ({ data: row, error: null }),
          };
          return query;
        },
        update(patch: Record<string, unknown>) {
          updates.push(patch);
          return {
            eq() {
              return {
                eq: async () => ({ error: null }),
              };
            },
          };
        },
      };
    },
  };
  return { admin: admin as unknown as SupabaseClient<Database>, updates };
}

describe('ensurePropertyGeocoded', () => {
  beforeEach(() => {
    lookup.mockReset();
  });

  it('keeps a service location that already has a map point', async () => {
    const { admin, updates } = adminFor({
      address_line1: '10 Main St',
      city: 'Sarasota',
      state: 'FL',
      postal_code: '34236',
      latitude: 27.3,
      longitude: -82.5,
    });

    const point = await ensurePropertyGeocoded(admin, 'tenant', 'property');

    expect(point).toEqual({ latitude: 27.3, longitude: -82.5 });
    expect(lookup).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it('looks up and saves a point when the address has none', async () => {
    lookup.mockResolvedValue({ point: { lat: 27.34, lng: -82.53 }, reason: null });
    const { admin, updates } = adminFor({
      address_line1: '10 Main St',
      city: 'Sarasota',
      state: 'FL',
      postal_code: '34236',
      latitude: null,
      longitude: null,
    });

    const point = await ensurePropertyGeocoded(admin, 'tenant', 'property');

    expect(lookup).toHaveBeenCalledWith({
      line1: '10 Main St',
      city: 'Sarasota',
      state: 'FL',
      postalCode: '34236',
    });
    expect(updates).toEqual([{ latitude: 27.34, longitude: -82.53, geocode_reason: null }]);
    expect(point).toEqual({ latitude: 27.34, longitude: -82.53 });
  });
});
