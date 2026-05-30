import { NavList } from '@/components/portal/NavList';
import {
  loadTenantNavItemsForShell,
  type TenantNavShellParams,
} from '@/lib/tenant/loadTenantNavItems';

export async function TenantNavList(props: TenantNavShellParams) {
  const navItems = await loadTenantNavItemsForShell(props);
  return <NavList items={navItems} />;
}
