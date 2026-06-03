import { describe, expect, it } from 'vitest';
import { isoToLocalDatetimeLocalValue } from './isoToLocalDatetimeLocalValue';
import { parseTenantDatetimeLocalToIso } from './parseTenantDatetimeLocal';

describe('parseTenantDatetimeLocalToIso', () => {
  it('round-trips Chicago civil times', () => {
    const timeZone = 'America/Chicago';
    const local = '2026-06-03T16:00';
    const iso = parseTenantDatetimeLocalToIso(local, timeZone);
    expect(iso).toBeTruthy();
    expect(isoToLocalDatetimeLocalValue(iso!, timeZone)).toBe(local);
  });

  it('round-trips New York civil times', () => {
    const timeZone = 'America/New_York';
    const local = '2026-06-03T16:00';
    const iso = parseTenantDatetimeLocalToIso(local, timeZone);
    expect(iso).toBeTruthy();
    expect(isoToLocalDatetimeLocalValue(iso!, timeZone)).toBe(local);
  });
});
