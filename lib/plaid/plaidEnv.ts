import { serverEnv } from '@/lib/env';

export type PlaidRuntimeEnv = 'sandbox' | 'development' | 'production';

/** Resolved Plaid API environment (defaults to sandbox when unset — local dev only). */
export function getPlaidRuntimeEnv(): PlaidRuntimeEnv {
  return (serverEnv.PLAID_ENV ?? 'sandbox') as PlaidRuntimeEnv;
}

export function isPlaidSandboxEnv(): boolean {
  return getPlaidRuntimeEnv() === 'sandbox';
}

export function isPlaidProductionEnv(): boolean {
  return getPlaidRuntimeEnv() === 'production';
}

/** Human-readable label for admin-facing UI. */
export function plaidEnvLabel(): string {
  switch (getPlaidRuntimeEnv()) {
    case 'production':
      return 'Production';
    case 'development':
      return 'Development';
    default:
      return 'Sandbox';
  }
}
