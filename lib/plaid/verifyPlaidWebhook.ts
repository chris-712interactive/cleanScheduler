import { createHash, timingSafeEqual } from 'node:crypto';
import { decodeProtectedHeader, importJWK, jwtVerify, type JWK } from 'jose';
import { getPlaidClient } from '@/lib/plaid/server';

const jwkCache = new Map<string, JWK>();

async function getPlaidVerificationJwk(keyId: string): Promise<JWK> {
  const cached = jwkCache.get(keyId);
  if (cached) return cached;

  const client = getPlaidClient();
  const response = await client.webhookVerificationKeyGet({ key_id: keyId });
  const key = response.data.key;
  if (!key) {
    throw new Error('Plaid did not return a webhook verification key.');
  }

  jwkCache.set(keyId, key as JWK);
  return key as JWK;
}

function parsePlaidWebhookVerifyEnabled(): boolean {
  const raw = process.env.PLAID_WEBHOOK_VERIFY?.trim().toLowerCase();
  if (raw === 'false' || raw === '0') return false;
  return true;
}

/** Verify Plaid-Verification JWT and body hash; returns parsed JSON body. */
export async function verifyPlaidWebhook<T extends Record<string, unknown>>(
  rawBody: string,
  verificationHeader: string | null,
): Promise<T> {
  if (!parsePlaidWebhookVerifyEnabled()) {
    return JSON.parse(rawBody) as T;
  }

  if (!verificationHeader?.trim()) {
    throw new Error('Missing Plaid-Verification header.');
  }

  const header = decodeProtectedHeader(verificationHeader);
  if (header.alg !== 'ES256') {
    throw new Error('Unexpected Plaid webhook JWT algorithm.');
  }
  const keyId = header.kid;
  if (!keyId) {
    throw new Error('Plaid webhook JWT missing key id.');
  }

  const jwk = await getPlaidVerificationJwk(keyId);
  const keyLike = await importJWK(jwk, 'ES256');

  const { payload } = await jwtVerify(verificationHeader, keyLike, {
    maxTokenAge: '5 min',
  });

  const claimedHash = payload.request_body_sha256;
  if (typeof claimedHash !== 'string') {
    throw new Error('Plaid webhook JWT missing request_body_sha256.');
  }

  const actualHash = createHash('sha256').update(rawBody, 'utf8').digest('hex');
  const claimedBuf = Buffer.from(claimedHash, 'utf8');
  const actualBuf = Buffer.from(actualHash, 'utf8');
  if (claimedBuf.length !== actualBuf.length || !timingSafeEqual(claimedBuf, actualBuf)) {
    throw new Error('Plaid webhook body hash mismatch.');
  }

  return JSON.parse(rawBody) as T;
}
