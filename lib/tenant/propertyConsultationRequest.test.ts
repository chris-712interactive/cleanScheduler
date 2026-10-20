import { describe, expect, it } from 'vitest';
import { propertyConsultationPhase } from '@/lib/tenant/propertyConsultationRequest';

describe('propertyConsultationPhase', () => {
  it('ignores locations the office created', () => {
    expect(propertyConsultationPhase(null, [])).toBe('none');
  });

  it('waits for a consultation until one is booked or finished', () => {
    expect(propertyConsultationPhase('2026-10-20T12:00:00.000Z', [])).toBe('needs_scheduling');
    expect(propertyConsultationPhase('2026-10-20T12:00:00.000Z', ['cancelled'])).toBe(
      'needs_scheduling',
    );
    expect(propertyConsultationPhase('2026-10-20T12:00:00.000Z', ['scheduled'])).toBe('scheduled');
    expect(propertyConsultationPhase('2026-10-20T12:00:00.000Z', ['scheduled', 'completed'])).toBe(
      'completed',
    );
  });
});
