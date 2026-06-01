import { Configuration, CountryCode, PlaidApi, PlaidEnvironments, Products } from 'plaid';
import { serverEnv } from '@/lib/env';
import { getPlaidRuntimeEnv } from '@/lib/plaid/plaidEnv';

let plaidClient: PlaidApi | null = null;
let plaidClientEnv: ReturnType<typeof getPlaidRuntimeEnv> | null = null;

export function isPlaidConfigured(): boolean {
  return Boolean(
    serverEnv.PLAID_CLIENT_ID?.trim() && serverEnv.PLAID_SECRET?.trim() && serverEnv.PLAID_ENV,
  );
}

function plaidBasePathForEnv(envName: ReturnType<typeof getPlaidRuntimeEnv>): string {
  switch (envName) {
    case 'production':
      return PlaidEnvironments.production as string;
    case 'development':
      return PlaidEnvironments.development as string;
    default:
      return PlaidEnvironments.sandbox as string;
  }
}

export function getPlaidClient(): PlaidApi {
  if (!isPlaidConfigured()) {
    throw new Error('Plaid is not configured. Set PLAID_CLIENT_ID, PLAID_SECRET, and PLAID_ENV.');
  }

  const envName = getPlaidRuntimeEnv();
  if (!plaidClient || plaidClientEnv !== envName) {
    plaidClientEnv = envName;
    plaidClient = new PlaidApi(
      new Configuration({
        basePath: plaidBasePathForEnv(envName),
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': serverEnv.PLAID_CLIENT_ID!,
            'PLAID-SECRET': serverEnv.PLAID_SECRET!,
          },
        },
      }),
    );
  }

  return plaidClient;
}

export async function createPlaidLinkToken(tenantId: string): Promise<string> {
  const client = getPlaidClient();
  const webhook = process.env.PLAID_WEBHOOK_URL?.trim() || undefined;
  const response = await client.linkTokenCreate({
    user: { client_user_id: tenantId },
    client_name: 'Clean Scheduler',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    ...(webhook ? { webhook } : {}),
  });
  const token = response.data.link_token;
  if (!token) throw new Error('Plaid did not return a link token.');
  return token;
}

export async function createPlaidUpdateLinkToken(
  tenantId: string,
  accessToken: string,
): Promise<string> {
  const client = getPlaidClient();
  const response = await client.linkTokenCreate({
    user: { client_user_id: tenantId },
    client_name: 'Clean Scheduler',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
    access_token: accessToken,
    ...(process.env.PLAID_WEBHOOK_URL?.trim()
      ? { webhook: process.env.PLAID_WEBHOOK_URL.trim() }
      : {}),
  });
  const token = response.data.link_token;
  if (!token) throw new Error('Plaid did not return an update link token.');
  return token;
}
