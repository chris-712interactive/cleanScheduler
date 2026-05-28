import { createHash, createHmac, randomBytes } from 'crypto';

export function hashIntegrationSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateApiKeyMaterial(): {
  fullKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const random = randomBytes(24).toString('base64url');
  const fullKey = `cs_live_${random}`;
  return {
    fullKey,
    keyPrefix: fullKey.slice(0, 16),
    keyHash: hashIntegrationSecret(fullKey),
  };
}

export function generateWebhookSigningSecret(): {
  secret: string;
  prefix: string;
} {
  const random = randomBytes(24).toString('base64url');
  const secret = `whsec_${random}`;
  return { secret, prefix: secret.slice(0, 12) };
}

export function signWebhookPayload(secret: string, timestamp: number, body: string): string {
  const payload = `${timestamp}.${body}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

export function buildWebhookSignatureHeader(secret: string, body: string): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signWebhookPayload(secret, timestamp, body);
  return `t=${timestamp},v1=${signature}`;
}
