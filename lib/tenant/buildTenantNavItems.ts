import type { NavItem } from '@/components/portal/types';
import type { TenantRole } from '@/lib/auth/types';
import {
  buildFieldEmployeeBottomNavItems,
  buildFieldEmployeeNavItems,
  isFieldEmployeeRole,
} from '@/lib/tenant/fieldEmployeeAccess';

const NAV_ITEMS_BASE: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Quotes', href: '/quotes', icon: 'quotes' },
  { label: 'Customers', href: '/customers', icon: 'customers' },
  { label: 'Schedule', href: '/schedule', icon: 'schedule' },
  { label: 'Reschedule requests', href: '/schedule/reschedule-requests', icon: 'rescheduleRequests' },
  { label: 'Employees', href: '/employees', icon: 'work' },
  { label: 'Campaigns', href: '/campaigns', icon: 'campaigns' },
  { label: 'Reports', href: '/reports', icon: 'reports' },
];

const TENANT_BOTTOM_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Schedule', href: '/schedule', icon: 'schedule' },
  { label: 'Customers', href: '/customers', icon: 'customers' },
  { label: 'Billing', href: '/billing', icon: 'billing' },
];

export function buildTenantNavItems(params: {
  role: TenantRole;
  subscriptionLocked: boolean;
  billingNavItem: NavItem;
  settingsNavItem: NavItem;
  campaignsNavEnabled: boolean;
  pendingRescheduleCount: number;
  gettingStartedNavItem?: NavItem | null;
}): NavItem[] {
  const {
    role,
    subscriptionLocked,
    billingNavItem,
    settingsNavItem,
    campaignsNavEnabled,
    pendingRescheduleCount,
    gettingStartedNavItem,
  } = params;

  if (isFieldEmployeeRole(role)) {
    if (subscriptionLocked) {
      return [{ label: 'Account', href: '/settings/account', icon: 'settings' }];
    }
    return buildFieldEmployeeNavItems();
  }

  const navItems: NavItem[] = subscriptionLocked
    ? [billingNavItem]
    : [
        ...NAV_ITEMS_BASE.slice(0, 1),
        ...(gettingStartedNavItem ? [gettingStartedNavItem] : []),
        ...NAV_ITEMS_BASE.slice(1, 6),
        billingNavItem,
        ...NAV_ITEMS_BASE.slice(6).filter(
          (item) => item.href !== '/campaigns' || campaignsNavEnabled,
        ),
        settingsNavItem,
      ];

  return navItems.map((item) => {
    if (item.href !== '/schedule/reschedule-requests' || pendingRescheduleCount <= 0) {
      return item;
    }
    const badge = pendingRescheduleCount > 99 ? '99+' : pendingRescheduleCount;
    return { ...item, badge };
  });
}

export function buildTenantBottomNavItems(params: {
  role: TenantRole;
  subscriptionLocked: boolean;
}): NavItem[] | undefined {
  const { role, subscriptionLocked } = params;

  if (subscriptionLocked) return undefined;

  if (isFieldEmployeeRole(role)) {
    return buildFieldEmployeeBottomNavItems();
  }

  return TENANT_BOTTOM_NAV;
}
