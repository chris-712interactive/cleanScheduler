import type { NavItem } from '@/components/portal/types';
import type { TenantRole } from '@/lib/auth/types';
import type { PermissionKey } from '@/lib/tenant/permissionCatalog';
import {
  buildFieldEmployeeBottomNavItems,
  buildFieldEmployeeNavItems,
  isFieldEmployeeRole,
} from '@/lib/tenant/fieldEmployeeAccess';
import { hasPermission } from '@/lib/tenant/resolveMembershipPermissions';

const NAV_ITEMS_BASE: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Quotes', href: '/quotes', icon: 'quotes' },
  { label: 'Customers', href: '/customers', icon: 'customers' },
  { label: 'Messages', href: '/messages', icon: 'messages' },
  { label: 'Schedule', href: '/schedule', icon: 'schedule' },
  {
    label: 'Reschedule requests',
    href: '/schedule/reschedule-requests',
    icon: 'rescheduleRequests',
  },
  { label: 'Employees', href: '/employees', icon: 'work' },
  { label: 'Campaigns', href: '/campaigns', icon: 'campaigns' },
  { label: 'Reports', href: '/reports', icon: 'reports' },
  { label: 'Accounting', href: '/accounting', icon: 'accounting' },
];

const TENANT_BOTTOM_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: 'dashboard', exact: true },
  { label: 'Schedule', href: '/schedule', icon: 'schedule' },
  { label: 'Customers', href: '/customers', icon: 'customers' },
  { label: 'Billing', href: '/billing', icon: 'billing' },
];

const NAV_ITEM_PERMISSION: Partial<Record<string, PermissionKey>> = {
  '/quotes': 'quotes.view',
  '/customers': 'customers.view',
  '/messages': 'messages.view',
  '/schedule': 'schedule.view',
  '/schedule/reschedule-requests': 'schedule.manage',
  '/employees': 'team.view',
  '/campaigns': 'campaigns.view',
  '/reports': 'reports.view',
  '/accounting': 'billing.view',
};

function navItemAllowed(
  item: NavItem,
  permissions: ReadonlySet<PermissionKey> | undefined,
): boolean {
  if (!permissions) return true;
  const required = NAV_ITEM_PERMISSION[item.href];
  if (!required) return true;
  return hasPermission(permissions, required);
}

export function buildTenantNavItems(params: {
  role: TenantRole;
  permissions?: ReadonlySet<PermissionKey>;
  subscriptionLocked: boolean;
  billingNavItem: NavItem;
  settingsNavItem: NavItem;
  campaignsNavEnabled: boolean;
  referralsNavEnabled: boolean;
  pendingRescheduleCount: number;
  openSupportThreadCount: number;
  pendingReferralCount: number;
  gettingStartedNavItem?: NavItem | null;
}): NavItem[] {
  const {
    role,
    permissions,
    subscriptionLocked,
    billingNavItem,
    settingsNavItem,
    campaignsNavEnabled,
    referralsNavEnabled,
    pendingRescheduleCount,
    openSupportThreadCount,
    pendingReferralCount,
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
        ...NAV_ITEMS_BASE.slice(1, 7),
        billingNavItem,
        ...NAV_ITEMS_BASE.slice(7).filter((item) => {
          if (item.href === '/campaigns' && !campaignsNavEnabled) return false;
          if (item.href === '/accounting') {
            if (permissions) return hasPermission(permissions, 'billing.view');
            return role === 'owner' || role === 'admin';
          }
          return true;
        }),
        ...(referralsNavEnabled
          ? [{ label: 'Referrals', href: '/referrals', icon: 'referrals' as const }]
          : []),
        settingsNavItem,
      ].filter((item) => {
        if (
          item.href === '/billing' &&
          permissions &&
          !hasPermission(permissions, 'billing.view')
        ) {
          return false;
        }
        if (
          item.href === '/settings' &&
          permissions &&
          !hasPermission(permissions, 'settings.view')
        ) {
          return false;
        }
        return navItemAllowed(item, permissions);
      });

  return navItems.map((item) => {
    if (item.href === '/schedule/reschedule-requests' && pendingRescheduleCount > 0) {
      const badge = pendingRescheduleCount > 99 ? '99+' : pendingRescheduleCount;
      return { ...item, badge };
    }
    if (item.href === '/messages' && openSupportThreadCount > 0) {
      const badge = openSupportThreadCount > 99 ? '99+' : openSupportThreadCount;
      return { ...item, badge };
    }
    if (item.href === '/referrals' && pendingReferralCount > 0) {
      const badge = pendingReferralCount > 99 ? '99+' : pendingReferralCount;
      return { ...item, badge };
    }
    return item;
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
