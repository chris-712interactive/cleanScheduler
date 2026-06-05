import { describe, expect, it } from 'vitest';
import {
  addConsultationDurationToStartIso,
  formatConsultationDurationLabel,
  parseConsultationDurationMinutes,
} from '@/lib/tenant/consultationDuration';

describe('parseConsultationDurationMinutes', () => {
  it('accepts valid minute values', () => {
    expect(parseConsultationDurationMinutes('60')).toBe(60);
    expect(parseConsultationDurationMinutes(90)).toBe(90);
  });

  it('rejects out-of-range values', () => {
    expect(parseConsultationDurationMinutes('10')).toBeNull();
    expect(parseConsultationDurationMinutes('500')).toBeNull();
    expect(parseConsultationDurationMinutes('')).toBeNull();
  });
});

describe('formatConsultationDurationLabel', () => {
  it('formats whole hours and minutes', () => {
    expect(formatConsultationDurationLabel(60)).toBe('1 hour');
    expect(formatConsultationDurationLabel(120)).toBe('2 hours');
    expect(formatConsultationDurationLabel(45)).toBe('45 min');
  });
});

describe('addConsultationDurationToStartIso', () => {
  it('extends the visit window by configured minutes', () => {
    const endsAt = addConsultationDurationToStartIso('2026-06-01T14:00:00.000Z', 90);
    expect(endsAt).toBe('2026-06-01T15:30:00.000Z');
  });
});
