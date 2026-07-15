import { describe, expect, it } from 'vitest';
import {
  formatCheckInLocationProof,
  googleMapsSearchUrl,
  parseCheckInLocationFromFormData,
} from '@/lib/schedule/checkInLocation';

describe('parseCheckInLocationFromFormData', () => {
  it('returns null when status is missing', () => {
    expect(parseCheckInLocationFromFormData(new FormData())).toBeNull();
  });

  it('parses a valid captured location', () => {
    const formData = new FormData();
    formData.set('check_in_location_status', 'captured');
    formData.set('check_in_lat', '39.9526');
    formData.set('check_in_lng', '-75.1652');
    formData.set('check_in_accuracy_m', '12.4');
    expect(parseCheckInLocationFromFormData(formData)).toEqual({
      status: 'captured',
      lat: 39.9526,
      lng: -75.1652,
      accuracyM: 12.4,
    });
  });

  it('treats invalid captured coords as unavailable', () => {
    const formData = new FormData();
    formData.set('check_in_location_status', 'captured');
    formData.set('check_in_lat', '999');
    formData.set('check_in_lng', '-75.1652');
    expect(parseCheckInLocationFromFormData(formData)).toEqual({
      status: 'unavailable',
      lat: null,
      lng: null,
      accuracyM: null,
    });
  });

  it('parses denied without coords', () => {
    const formData = new FormData();
    formData.set('check_in_location_status', 'denied');
    expect(parseCheckInLocationFromFormData(formData)).toEqual({
      status: 'denied',
      lat: null,
      lng: null,
      accuracyM: null,
    });
  });
});

describe('formatCheckInLocationProof', () => {
  it('formats captured coords with maps link', () => {
    const proof = formatCheckInLocationProof({
      status: 'captured',
      lat: 39.9526,
      lng: -75.1652,
      accuracyM: 12.4,
    });
    expect(proof?.label).toContain('39.95260');
    expect(proof?.label).toContain('±12 m');
    expect(proof?.mapsUrl).toBe(googleMapsSearchUrl(39.9526, -75.1652));
  });

  it('explains denied permission', () => {
    expect(
      formatCheckInLocationProof({
        status: 'denied',
        lat: null,
        lng: null,
        accuracyM: null,
      }),
    ).toEqual({ label: 'Location permission denied', mapsUrl: null });
  });
});
