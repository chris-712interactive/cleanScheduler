import { describe, expect, it } from 'vitest';
import {
  mergeConsultationNotesIntoSiteNotes,
  sanitizeConsultationNotes,
} from '@/lib/visits/consultationNotes';

describe('sanitizeConsultationNotes', () => {
  it('trims whitespace', () => {
    expect(sanitizeConsultationNotes('  parking in rear  ')).toBe('parking in rear');
  });

  it('caps long input', () => {
    const long = 'x'.repeat(5000);
    expect(sanitizeConsultationNotes(long).length).toBe(4000);
  });
});

describe('mergeConsultationNotesIntoSiteNotes', () => {
  it('replaces when site notes are empty', () => {
    expect(mergeConsultationNotesIntoSiteNotes(null, 'Gate code 1234')).toBe('Gate code 1234');
    expect(mergeConsultationNotesIntoSiteNotes('   ', 'Pets: dog')).toBe('Pets: dog');
  });

  it('appends a dated block when site notes already exist', () => {
    const merged = mergeConsultationNotesIntoSiteNotes(
      'Key under mat',
      'Hardwood floors need care',
      new Date('2026-07-18T15:00:00.000Z'),
    );
    expect(merged).toBe('Key under mat\n\n— Consultation 2026-07-18 —\nHardwood floors need care');
  });

  it('leaves existing notes alone when consultation notes are blank', () => {
    expect(mergeConsultationNotesIntoSiteNotes('Keep existing', '  ')).toBe('Keep existing');
  });
});
