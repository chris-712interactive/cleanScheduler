'use client';

import type { CheckInLocationStatus } from '@/lib/schedule/checkInLocation';

export type CapturedDeviceLocation =
  | {
      status: 'captured';
      lat: number;
      lng: number;
      accuracyM: number | null;
    }
  | {
      status: Exclude<CheckInLocationStatus, 'captured'>;
      lat: null;
      lng: null;
      accuracyM: null;
    };

const GEO_TIMEOUT_MS = 12_000;

/**
 * Request a one-shot browser location for visit check-in proof.
 * Never throws — permission / timeout / missing API become status outcomes.
 */
export function captureDeviceLocation(): Promise<CapturedDeviceLocation> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({
      status: 'unsupported',
      lat: null,
      lng: null,
      accuracyM: null,
    });
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          resolve({ status: 'unavailable', lat: null, lng: null, accuracyM: null });
          return;
        }
        resolve({
          status: 'captured',
          lat: latitude,
          lng: longitude,
          accuracyM: Number.isFinite(accuracy) ? accuracy : null,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          resolve({ status: 'denied', lat: null, lng: null, accuracyM: null });
          return;
        }
        resolve({ status: 'unavailable', lat: null, lng: null, accuracyM: null });
      },
      {
        enableHighAccuracy: true,
        timeout: GEO_TIMEOUT_MS,
        maximumAge: 30_000,
      },
    );
  });
}

/** Append check-in location fields to FormData for the server action. */
export function appendCheckInLocationToFormData(
  formData: FormData,
  location: CapturedDeviceLocation,
): void {
  formData.set('check_in_location_status', location.status);
  if (location.status === 'captured') {
    formData.set('check_in_lat', String(location.lat));
    formData.set('check_in_lng', String(location.lng));
    if (location.accuracyM != null) {
      formData.set('check_in_accuracy_m', String(location.accuracyM));
    }
  }
}
