import type { TenantRole } from '@/lib/auth/types';

export const PERMISSION_KEYS = [
  'quotes.view',
  'quotes.manage',
  'billing.view',
  'billing.manage',
  'team.view',
  'team.invite',
  'team.manage_roles',
  'team.manage_members',
  'settings.view',
  'settings.operations',
  'settings.business',
  'messages.view',
  'messages.reply',
  'schedule.view',
  'schedule.manage',
  'customers.view',
  'customers.manage',
  'reports.view',
  'reports.export',
  'campaigns.view',
  'campaigns.manage',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  group: string;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: 'quotes.view',
    label: 'View quotes',
    description: 'See the quotes board and quote details.',
    group: 'Quotes',
  },
  {
    key: 'quotes.manage',
    label: 'Manage quotes',
    description: 'Create, edit, send, and move quotes through the pipeline.',
    group: 'Quotes',
  },
  {
    key: 'billing.view',
    label: 'View billing',
    description: 'See invoices, payments, and billing summaries.',
    group: 'Billing',
  },
  {
    key: 'billing.manage',
    label: 'Manage billing',
    description: 'Create invoices, record payments, and configure payment setup.',
    group: 'Billing',
  },
  {
    key: 'team.view',
    label: 'View team',
    description: 'See the team directory.',
    group: 'Team',
  },
  {
    key: 'team.invite',
    label: 'Invite team members',
    description: 'Send and manage pending invites.',
    group: 'Team',
  },
  {
    key: 'team.manage_members',
    label: 'Manage team members',
    description: 'Change roles, activation, and profile details for members.',
    group: 'Team',
  },
  {
    key: 'team.manage_roles',
    label: 'Manage custom roles',
    description: 'Create and edit workspace roles and permission sets.',
    group: 'Team',
  },
  {
    key: 'settings.view',
    label: 'View settings',
    description: 'Open workspace settings pages allowed for this role.',
    group: 'Settings',
  },
  {
    key: 'settings.operations',
    label: 'Operations settings',
    description: 'Edit scheduling, services, and operational defaults.',
    group: 'Settings',
  },
  {
    key: 'settings.business',
    label: 'Business settings',
    description: 'Edit business profile, branding, and address.',
    group: 'Settings',
  },
  {
    key: 'messages.view',
    label: 'View messages',
    description: 'Open the customer support inbox.',
    group: 'Messages',
  },
  {
    key: 'messages.reply',
    label: 'Reply to messages',
    description: 'Send replies in customer support threads.',
    group: 'Messages',
  },
  {
    key: 'schedule.view',
    label: 'View schedule',
    description: 'See scheduled visits and calendar views.',
    group: 'Schedule',
  },
  {
    key: 'schedule.manage',
    label: 'Manage schedule',
    description: 'Create visits, assign crew, and handle reschedule requests.',
    group: 'Schedule',
  },
  {
    key: 'customers.view',
    label: 'View customers',
    description: 'See customer records and properties.',
    group: 'Customers',
  },
  {
    key: 'customers.manage',
    label: 'Manage customers',
    description: 'Create and edit customers, properties, and portal access.',
    group: 'Customers',
  },
  {
    key: 'reports.view',
    label: 'View reports',
    description: 'Open business reports and analytics.',
    group: 'Reports',
  },
  {
    key: 'reports.export',
    label: 'Export reports',
    description: 'Download report CSV and PDF exports.',
    group: 'Reports',
  },
  {
    key: 'campaigns.view',
    label: 'View campaigns',
    description: 'See email campaign performance.',
    group: 'Campaigns',
  },
  {
    key: 'campaigns.manage',
    label: 'Manage campaigns',
    description: 'Create and send email campaigns.',
    group: 'Campaigns',
  },
];

const OWNER_ADMIN_PERMISSIONS: PermissionKey[] = [...PERMISSION_KEYS];

const EMPLOYEE_PERMISSIONS: PermissionKey[] = ['schedule.view', 'settings.view'];

const VIEWER_PERMISSIONS: PermissionKey[] = [
  'quotes.view',
  'customers.view',
  'schedule.view',
  'team.view',
  'messages.view',
  'settings.view',
];

/** Default grants for built-in system roles (used when DB rows are unavailable). */
export const DEFAULT_SYSTEM_ROLE_PERMISSIONS: Record<TenantRole, readonly PermissionKey[]> = {
  owner: OWNER_ADMIN_PERMISSIONS,
  admin: OWNER_ADMIN_PERMISSIONS,
  employee: EMPLOYEE_PERMISSIONS,
  viewer: VIEWER_PERMISSIONS,
};

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as readonly string[]).includes(value);
}

export function permissionDefinition(key: PermissionKey): PermissionDefinition | undefined {
  return PERMISSION_DEFINITIONS.find((entry) => entry.key === key);
}

export function permissionsByGroup(): Map<string, PermissionDefinition[]> {
  const grouped = new Map<string, PermissionDefinition[]>();
  for (const def of PERMISSION_DEFINITIONS) {
    const list = grouped.get(def.group) ?? [];
    list.push(def);
    grouped.set(def.group, list);
  }
  return grouped;
}

export function defaultPermissionsForSystemRole(role: TenantRole): Set<PermissionKey> {
  return new Set(DEFAULT_SYSTEM_ROLE_PERMISSIONS[role]);
}
