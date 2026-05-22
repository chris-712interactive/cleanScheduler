import { redirect } from 'next/navigation';
import type { NavItem } from '@/components/portal/types';
import type { TenantRole } from '@/lib/auth/types';
import { teamRoleLabel } from '@/lib/tenant/teamMemberDisplay';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FIELD_EMPLOYEE_SCHEDULE_ADMIN_PREFIXES = [
  '/schedule/new',
  '/schedule/recurring',
  '/schedule/reschedule-requests',
];

export function isFieldEmployeeRole(role: TenantRole): boolean {
  return role === 'employee';
}

export function fieldEmployeeHomePath(): string {
  return '/schedule?employee=me&view=today';
}

function normalizeBrowserPath(path: string): string {
  const base = path.split('?')[0]?.trim() || '/';
  if (base.length > 1 && base.endsWith('/')) {
    return base.slice(0, -1);
  }
  return base;
}

export function fieldEmployeeCanAccessBrowserPath(pathname: string): boolean {
  const path = normalizeBrowserPath(pathname);

  if (path === '/' || path === '/dashboard') {
    return false;
  }

  if (path === '/settings' || path.startsWith('/settings/')) {
    return path === '/settings/account';
  }

  for (const blocked of FIELD_EMPLOYEE_SCHEDULE_ADMIN_PREFIXES) {
    if (path === blocked || path.startsWith(`${blocked}/`)) {
      return false;
    }
  }

  if (path === '/schedule') {
    return true;
  }

  if (path.startsWith('/schedule/')) {
    const segment = path.slice('/schedule/'.length).split('/')[0] ?? '';
    return UUID_RE.test(segment);
  }

  return false;
}

export function enforceFieldEmployeeRouteAccess(
  role: TenantRole,
  browserPathname: string | null | undefined,
): void {
  if (!isFieldEmployeeRole(role)) return;

  const path = browserPathname?.trim() || '/';

  if (path === '/' || path === '') {
    redirect(fieldEmployeeHomePath());
  }

  if (path === '/settings') {
    redirect('/settings/account');
  }

  if (!fieldEmployeeCanAccessBrowserPath(path)) {
    redirect(`${fieldEmployeeHomePath()}&access=restricted`);
  }
}

export function buildFieldEmployeeNavItems(): NavItem[] {
  return [
    { label: 'Schedule', href: fieldEmployeeHomePath(), icon: 'schedule' },
    { label: 'Account', href: '/settings/account', icon: 'settings' },
  ];
}

export function buildFieldEmployeeBottomNavItems(): NavItem[] {
  return buildFieldEmployeeNavItems();
}

export function identitySubtitleForRole(role: TenantRole): string {
  return teamRoleLabel(role);
}
