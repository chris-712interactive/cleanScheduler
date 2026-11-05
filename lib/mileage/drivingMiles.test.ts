import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchDrivingMiles } from '@/lib/mileage/drivingMiles';

const from = { lat: 26.64, lng: -81.87 };
const to = { lat: 26.55, lng: -81.8 };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('fetchDrivingMiles', () => {
  it('stays blank when the Mapricot key is missing', async () => {
    vi.stubEnv('MAPRICOT_API_KEY', '');
    const fetchImpl = vi.fn();
    await expect(fetchDrivingMiles(from, to, fetchImpl)).resolves.toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('posts the two pins and reads distanceMeters', async () => {
    vi.stubEnv('MAPRICOT_API_KEY', 'test-key');
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ routes: [{ distanceMeters: 1609 }] }), { status: 200 }),
    );
    await expect(fetchDrivingMiles(from, to, fetchImpl)).resolves.toBe(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.mapricot.com/routing/v1/route',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ authorization: 'Bearer test-key' }),
        body: JSON.stringify({
          waypoints: [
            { lat: 26.64, lon: -81.87 },
            { lat: 26.55, lon: -81.8 },
          ],
          mode: 'drive',
        }),
      }),
    );
  });

  it('leaves the leg blank when Mapricot has no route', async () => {
    vi.stubEnv('MAPRICOT_API_KEY', 'test-key');
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ routes: [] }), { status: 200 }),
    );
    await expect(fetchDrivingMiles(from, to, fetchImpl)).resolves.toBeNull();
  });
});
