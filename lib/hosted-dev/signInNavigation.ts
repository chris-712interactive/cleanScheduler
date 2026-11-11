/** `/sign-in/mfa` and deeper MFA routes, such as `/sign-in/mfa/extra`. */
export function isMfaSignInPath(pathname: string): boolean {
  return pathname === '/sign-in/mfa' || pathname.startsWith('/sign-in/mfa/');
}

export type SignInNavigation = 'pending' | 'settled' | 'mfa' | 'left-host';

/**
 * Password sign-in is done when the browser leaves the form, stops on MFA,
 * or changes host. A host change is not a stuck sign-in page.
 */
export function classifySignInNavigation(startHostname: string, landed: URL): SignInNavigation {
  if (landed.hostname !== startHostname) return 'left-host';
  if (isMfaSignInPath(landed.pathname)) return 'mfa';
  if (!landed.pathname.startsWith('/sign-in')) return 'settled';
  return 'pending';
}
