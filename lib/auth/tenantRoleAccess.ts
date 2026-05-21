import type { TenantRole } from '@/lib/auth/types';

const ROLE_RANK: Record<TenantRole, number> = {
  viewer: 0,
  employee: 1,
  admin: 2,
  owner: 3,
};

export function hasMinimumTenantRole(role: TenantRole, minimum: TenantRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Record manual payments at jobs or on invoices; mark audit stages. */
export function canRecordInvoicePayments(role: TenantRole): boolean {
  return hasMinimumTenantRole(role, 'employee');
}

/** Create invoices, refunds, bank link, compensation, Connect setup. */
export function canManageCustomerBilling(role: TenantRole): boolean {
  return hasMinimumTenantRole(role, 'admin');
}

/** Plaid connect, sync, match, disconnect. */
export function canManageBankReconciliation(role: TenantRole): boolean {
  return hasMinimumTenantRole(role, 'admin');
}

export function tenantRoleError(role: TenantRole, minimum: TenantRole): string | null {
  if (hasMinimumTenantRole(role, minimum)) return null;
  const labels: Record<TenantRole, string> = {
    owner: 'Owner',
    admin: 'Admin',
    employee: 'Employee',
    viewer: 'Viewer',
  };
  return `This action requires ${labels[minimum]} access or higher.`;
}
