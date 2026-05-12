import { isDev, isLocal } from '@/lib/env';

/** Copy for the red portal banner when not in production. */
export function getNonProdPortalBanner(): string | null {
  if (isLocal()) {
    return 'Local development — no real charges or production data.';
  }
  if (isDev()) {
    return 'Development environment — no real charges.';
  }
  return null;
}
