import { describe, expect, it } from 'vitest';
import {
  publicBookingModeError,
  publicBookingModeFromRow,
  publicBookingPageOpen,
} from '@/lib/booking/publicBookingMode';

describe('public booking mode', () => {
  it('keeps a missing settings row on the request form', () => {
    expect(publicBookingModeFromRow(null)).toBe('request');
    expect(publicBookingPageOpen('request')).toBe(true);
  });

  it('maps a disabled legacy flag to off when mode is absent', () => {
    expect(publicBookingModeFromRow({ public_booking_request_enabled: false })).toBe('off');
    expect(publicBookingPageOpen('off')).toBe(false);
  });

  it('prefers the explicit mode over the legacy flag', () => {
    expect(
      publicBookingModeFromRow({
        public_booking_mode: 'instant',
        public_booking_request_enabled: false,
      }),
    ).toBe('instant');
  });

  it('rejects the wrong public action', () => {
    expect(publicBookingModeError('off', 'request')).toMatch(/unavailable/i);
    expect(publicBookingModeError('request', 'instant')).toMatch(/unavailable/i);
    expect(publicBookingModeError('instant', 'request')).toMatch(/unavailable/i);
    expect(publicBookingModeError('instant', 'instant')).toBeNull();
    expect(publicBookingModeError('request', 'request')).toBeNull();
  });
});
