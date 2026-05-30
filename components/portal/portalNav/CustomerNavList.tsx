import { NavList } from '@/components/portal/NavList';
import { loadCustomerNavItemsForShell } from '@/lib/customer/loadCustomerNavItems';

export async function CustomerNavList({ userId }: { userId: string }) {
  const navItems = await loadCustomerNavItemsForShell(userId);
  return <NavList items={navItems} />;
}
