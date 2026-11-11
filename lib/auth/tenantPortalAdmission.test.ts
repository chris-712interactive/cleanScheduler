import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPlatformAdminRole, isPlatformStaffRole } from '@/lib/auth/platformRoles';
import { decideTenantPortalAdmission } from '@/lib/auth/tenantPortalAdmission';
import { appRoleForNewTenantMember, appRoleForTenantMember } from '@/lib/auth/tenantMemberAppRole';
import type { TenantRole } from '@/lib/auth/types';

const HOST = 'tenant-commercial';
const OTHER = 'tenant-residential';

describe('decideTenantPortalAdmission', () => {
  it('denies a non-member, non-staff owner with reason=membership', () => {
    const decision = decideTenantPortalAdmission({
      appRole: 'employee',
      masqueradeTargetTenantId: null,
      hostTenantId: HOST,
      hostTenantResolved: true,
    });
    expect(decision).toEqual({ kind: 'deny', reason: 'membership' });
  });

  it('denies a platform-admin label with no masquerade session', () => {
    const decision = decideTenantPortalAdmission({
      appRole: 'admin',
      masqueradeTargetTenantId: null,
      hostTenantId: HOST,
      hostTenantResolved: true,
    });
    expect(decision).toEqual({ kind: 'deny', reason: 'membership' });
  });

  it('denies platform staff whose masquerade targets a different tenant', () => {
    const decision = decideTenantPortalAdmission({
      appRole: 'super_admin',
      masqueradeTargetTenantId: OTHER,
      hostTenantId: HOST,
      hostTenantResolved: true,
    });
    expect(decision).toEqual({ kind: 'deny', reason: 'membership' });
  });

  it('allows platform staff only when masquerade aims at this tenant', () => {
    expect(
      decideTenantPortalAdmission({
        appRole: 'admin',
        masqueradeTargetTenantId: HOST,
        hostTenantId: HOST,
        hostTenantResolved: true,
      }),
    ).toEqual({ kind: 'masquerade' });
    expect(
      decideTenantPortalAdmission({
        appRole: 'super_admin',
        masqueradeTargetTenantId: HOST,
        hostTenantId: HOST,
        hostTenantResolved: true,
      }),
    ).toEqual({ kind: 'masquerade' });
  });

  it('does not treat a masquerade claim as access for a non-staff user', () => {
    const decision = decideTenantPortalAdmission({
      appRole: 'employee',
      masqueradeTargetTenantId: HOST,
      hostTenantId: HOST,
      hostTenantResolved: true,
    });
    expect(decision).toEqual({ kind: 'deny', reason: 'membership' });
  });

  it('does not let sales open a workspace through a masquerade claim', () => {
    const decision = decideTenantPortalAdmission({
      appRole: 'sales',
      masqueradeTargetTenantId: HOST,
      hostTenantId: HOST,
      hostTenantResolved: true,
    });
    expect(decision).toEqual({ kind: 'deny', reason: 'membership' });
  });

  it('sends an explicit support session for a missing host to unknown_tenant', () => {
    const decision = decideTenantPortalAdmission({
      appRole: 'admin',
      masqueradeTargetTenantId: HOST,
      hostTenantId: null,
      hostTenantResolved: true,
    });
    expect(decision).toEqual({ kind: 'deny', reason: 'unknown_tenant' });
  });

  it('fails closed when the host tenant was not resolved', () => {
    const decision = decideTenantPortalAdmission({
      appRole: 'admin',
      masqueradeTargetTenantId: HOST,
      hostTenantId: null,
      hostTenantResolved: false,
    });
    expect(decision).toEqual({ kind: 'deny', reason: 'membership' });
  });
});

describe('tenant member platform role', () => {
  const tenantRoles: TenantRole[] = ['owner', 'admin', 'employee', 'viewer'];

  it('assigns employee, never a platform role, for new trial owners and invites', () => {
    const appRole = appRoleForNewTenantMember();
    expect(appRole).toBe('employee');
    expect(isPlatformAdminRole(appRole)).toBe(false);
    expect(isPlatformStaffRole(appRole)).toBe(false);
    expect(tenantRoles).toEqual(['owner', 'admin', 'employee', 'viewer']);
  });

  it('keeps an invited tenant admin off the platform admin role', () => {
    expect(appRoleForTenantMember(null)).toBe('employee');
    expect(appRoleForTenantMember('employee')).toBe('employee');
    expect(appRoleForTenantMember('customer')).toBe('employee');
    expect(isPlatformAdminRole(appRoleForTenantMember('employee'))).toBe(false);
  });

  it('does not strip an existing platform staff role during a tenant role edit', () => {
    expect(appRoleForTenantMember('admin')).toBe('admin');
    expect(appRoleForTenantMember('super_admin')).toBe('super_admin');
    expect(appRoleForTenantMember('sales')).toBe('sales');
  });

  it('signup, invite, member edits, and the dev seed do not stamp platform admin', () => {
    const files = [
      'app/marketing/onboarding/actions.ts',
      'app/marketing/complete-employee-invite/actions.ts',
      'app/tenant/employees/employeeMemberActions.ts',
      'supabase/seed/0001_dev_smoke_seed.sql',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, file).not.toMatch(/app_role:\s*['"]admin['"]/);
      expect(source, file).not.toMatch(/app_role',\s*'admin'/);
      expect(source, file).not.toMatch(/'admin'::public\.app_role/);
      expect(source, file).not.toMatch(/nextRole === 'admin' \? 'admin'/);
      expect(source, file).not.toMatch(/tr === 'admin' \? 'admin'/);
    }
    const onboarding = readFileSync(
      resolve(process.cwd(), 'app/marketing/onboarding/actions.ts'),
      'utf8',
    );
    const invite = readFileSync(
      resolve(process.cwd(), 'app/marketing/complete-employee-invite/actions.ts'),
      'utf8',
    );
    const members = readFileSync(
      resolve(process.cwd(), 'app/tenant/employees/employeeMemberActions.ts'),
      'utf8',
    );
    expect(onboarding).toContain('appRoleForNewTenantMember');
    expect(invite).toContain('appRoleForNewTenantMember');
    expect(invite).toContain('appRoleForTenantMember');
    expect(members).toContain('appRoleForTenantMember');
  });
});
