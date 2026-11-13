import type { PlaidApi } from 'plaid';
import { logOutboundSuppressed, suppressedId } from '@/lib/outbound/suppression';

function plaidData(method: string): { data: Record<string, unknown> } {
  logOutboundSuppressed('plaid', method);
  const id = suppressedId('plaid', method);
  if (method === 'linkTokenCreate') {
    return { data: { link_token: id, expiration: '2099-01-01T00:00:00Z', request_id: id } };
  }
  if (method === 'itemPublicTokenExchange') {
    return {
      data: {
        access_token: suppressedId('plaid', 'access'),
        item_id: suppressedId('plaid', 'item'),
        request_id: id,
      },
    };
  }
  if (method === 'transactionsSync') {
    return {
      data: {
        added: [],
        modified: [],
        removed: [],
        next_cursor: id,
        has_more: false,
        request_id: id,
      },
    };
  }
  if (method === 'accountsGet') {
    return { data: { accounts: [], item: { institution_id: null }, request_id: id } };
  }
  if (method === 'webhookVerificationKeyGet') {
    return { data: { request_id: id } };
  }
  return { data: { request_id: id } };
}

/** Plaid-shaped client. Every method resolves locally. Verification keys are withheld. */
export function suppressedPlaidClient(): PlaidApi {
  return new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop !== 'string') return undefined;
        return () => Promise.resolve(plaidData(prop));
      },
    },
  ) as PlaidApi;
}
