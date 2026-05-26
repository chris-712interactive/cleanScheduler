import { describe, expect, it } from 'vitest';
import {
  canMarkManualPaymentBounced,
  canMarkManualPaymentCleared,
  manualPaymentAuditStage,
  parseCheckNumberFromNotes,
} from '@/lib/billing/manualPaymentAudit';

describe('manualPaymentAudit', () => {
  it('tracks check clearance after deposit', () => {
    const stage = manualPaymentAuditStage({
      received_at: '2026-01-01T00:00:00Z',
      deposited_at: '2026-01-02T00:00:00Z',
      cleared_at: null,
      bounced_at: null,
      method: 'check',
    });
    expect(stage).toBe('awaiting_clearance');
    expect(canMarkManualPaymentCleared(stage)).toBe(true);
    expect(canMarkManualPaymentBounced(stage)).toBe(true);
  });

  it('parses check numbers from legacy notes', () => {
    expect(parseCheckNumberFromNotes('Check #1042 (collected at job completion)')).toBe('1042');
  });
});
