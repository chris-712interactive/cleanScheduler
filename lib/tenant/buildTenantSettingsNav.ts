import type { NavItem } from '@/components/portal/types';

/** Settings hub entry — no sidebar sub-links; drill in from the hub cards. */
export function buildTenantSettingsNavItem(): NavItem {
  return {
    label: 'Settings',
    href: '/settings',
    icon: 'settings',
  };
}
