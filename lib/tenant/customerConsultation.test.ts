import { describe, expect, it } from 'vitest';
import {
  consultationNeedsStaffAction,
  resolveConsultationStatusFromVisits,
  type ConsultationVisitSummary,
} from '@/lib/tenant/customerConsultation';

const scheduledVisit: ConsultationVisitSummary = {
  id: 'visit-1',
  startsAt: '2026-06-01T14:00:00.000Z',
  endsAt: '2026-06-01T15:00:00.000Z',
  status: 'scheduled',
  title: 'Consultation',
};

const completedVisit: ConsultationVisitSummary = {
  ...scheduledVisit,
  id: 'visit-2',
  status: 'completed',
};

describe('resolveConsultationStatusFromVisits', () => {
  it('returns not_required when setting is off', () => {
    expect(resolveConsultationStatusFromVisits(false, [])).toBe('not_required');
  });

  it('returns needs_scheduling when no consultation visits exist', () => {
    expect(resolveConsultationStatusFromVisits(true, [])).toBe('needs_scheduling');
  });

  it('returns scheduled when a consultation is booked', () => {
    expect(resolveConsultationStatusFromVisits(true, [scheduledVisit])).toBe('scheduled');
  });

  it('returns completed when a consultation is completed', () => {
    expect(resolveConsultationStatusFromVisits(true, [completedVisit])).toBe('completed');
  });
});

describe('consultationNeedsStaffAction', () => {
  it('flags only customers who still need a consultation scheduled', () => {
    expect(consultationNeedsStaffAction('needs_scheduling')).toBe(true);
    expect(consultationNeedsStaffAction('scheduled')).toBe(false);
    expect(consultationNeedsStaffAction('completed')).toBe(false);
    expect(consultationNeedsStaffAction('not_required')).toBe(false);
  });
});
