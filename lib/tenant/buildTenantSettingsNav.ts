import type { NavItem } from '@/components/portal/types';

/** Settings sidebar item with workspace configuration sub-links. */
export function buildTenantSettingsNavItem(): NavItem {
  return {
    label: 'Settings',
    href: '/settings',
    icon: 'settings',
    children: [
      { label: 'Business', href: '/settings/business', icon: 'settings' },
      { label: 'Account', href: '/settings/account', icon: 'settings' },
      { label: 'Operations', href: '/settings/operations', icon: 'settings' },
      { label: 'Roles', href: '/settings/roles', icon: 'settings' },
    ],
  };
}
