import type { NavItem } from './types';

function itemMatchesPath(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function flattenNavItems(items: NavItem[]): NavItem[] {
  const flat: NavItem[] = [];
  for (const item of items) {
    flat.push(item);
    if (item.children?.length) {
      flat.push(...item.children);
    }
  }
  return flat;
}

/** Parent items with children stay highlighted for any route under their href prefix. */
function isNavParentWithChildrenActive(pathname: string, item: NavItem): boolean {
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** True when pathname matches this item and no other nav item is a more specific match. */
export function isNavItemActive(pathname: string, item: NavItem, allItems: NavItem[]): boolean {
  if (item.children?.length) {
    return isNavParentWithChildrenActive(pathname, item);
  }

  if (!itemMatchesPath(pathname, item)) return false;

  const flat = flattenNavItems(allItems);

  return !flat.some((other) => {
    if (other.href === item.href) return false;
    if (!other.href.startsWith(`${item.href}/`)) return false;
    return itemMatchesPath(pathname, other);
  });
}

/** Active state for a nested link under a parent nav group. */
export function isNavChildActive(pathname: string, child: NavItem, siblings: NavItem[]): boolean {
  if (!itemMatchesPath(pathname, child)) return false;

  return !siblings.some((other) => {
    if (other.href === child.href) return false;
    if (!other.href.startsWith(`${child.href}/`)) return false;
    return itemMatchesPath(pathname, other);
  });
}
