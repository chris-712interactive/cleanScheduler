import type { TenantRole } from '@/lib/auth/types';

export interface TenantRoleDefinition {
  role: TenantRole;
  label: string;
  summary: string;
  permissions: string[];
}

export const TENANT_ROLE_DEFINITIONS: TenantRoleDefinition[] = [
  {
    role: 'owner',
    label: 'Owner',
    summary:
      'Full workspace control including billing, team management, and all business settings.',
    permissions: [
      'Manage business profile, branding, and address',
      'Configure operations and customer payment defaults',
      'Invite and manage all team roles',
      'Access billing, invoices, and Stripe Connect',
      'Schedule, quote, and manage customers',
    ],
  },
  {
    role: 'admin',
    label: 'Admin',
    summary: 'Day-to-day workspace administration without ownership transfer.',
    permissions: [
      'Manage business profile, branding, and address',
      'Configure operations and customer payment defaults',
      'Invite employees and viewers; manage their roles',
      'Access billing, invoices, and Stripe Connect',
      'Schedule, quote, and manage customers',
    ],
  },
  {
    role: 'employee',
    label: 'Field employee',
    summary: 'Mobile-first access for crew — assigned jobs, check-in, and proof photos only.',
    permissions: [
      'View assigned schedule and visit details',
      'Check in, complete jobs, and attach proof photos',
      'Record on-site cash or check payments at completion',
      'Update personal account settings (profile, password, appearance)',
    ],
  },
  {
    role: 'viewer',
    label: 'Viewer',
    summary: 'Read-only access for stakeholders who need visibility without changes.',
    permissions: [
      'View schedule, quotes, and customers',
      'View team directory',
      'Update personal account settings',
    ],
  },
];

export function tenantRoleDefinition(role: TenantRole): TenantRoleDefinition | undefined {
  return TENANT_ROLE_DEFINITIONS.find((entry) => entry.role === role);
}
