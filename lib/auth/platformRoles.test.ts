import { describe, expect, it } from 'vitest';
import { isSalesLeadStage, salesTaskKindLabel } from '@/lib/admin/salesTypes';
import {
  isPlatformAdminRole,
  isPlatformSalesRole,
  isPlatformStaffRole,
} from '@/lib/auth/platformRoles';

describe('platformRoles', () => {
  it('treats sales as staff but not founder admin', () => {
    expect(isPlatformStaffRole('sales')).toBe(true);
    expect(isPlatformAdminRole('sales')).toBe(false);
    expect(isPlatformSalesRole('sales')).toBe(true);
    expect(isPlatformStaffRole('admin')).toBe(true);
    expect(isPlatformAdminRole('admin')).toBe(true);
    expect(isPlatformStaffRole('employee')).toBe(false);
  });
});

describe('salesTypes', () => {
  it('accepts pipeline stages', () => {
    expect(isSalesLeadStage('trial')).toBe(true);
    expect(isSalesLeadStage('unknown')).toBe(false);
  });

  it('labels known task kinds and falls back for unknown values', () => {
    expect(salesTaskKindLabel('trial_expiring')).toBe('Trial expiring');
    expect(salesTaskKindLabel('unknown')).toBe('unknown');
  });
});
