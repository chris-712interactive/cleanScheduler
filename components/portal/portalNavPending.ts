export const PORTAL_NAV_PENDING_ATTR = 'data-portal-nav-pending';

const PENDING_CLEAR_MS = 8_000;

let clearTimer: number | undefined;

export function markPortalNavPending(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute(PORTAL_NAV_PENDING_ATTR, '');

  if (clearTimer) window.clearTimeout(clearTimer);
  clearTimer = window.setTimeout(() => {
    clearPortalNavPending();
  }, PENDING_CLEAR_MS);
}

export function clearPortalNavPending(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.removeAttribute(PORTAL_NAV_PENDING_ATTR);

  if (clearTimer) {
    window.clearTimeout(clearTimer);
    clearTimer = undefined;
  }
}
