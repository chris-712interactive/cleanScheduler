import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Factor, User } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  aalFromAccessToken,
  amrMethodsFromAccessToken,
  sessionIdFromAccessToken,
} from '@/lib/auth/accessTokenAmr';

/** Request header set by the proxy after it has already validated the session. */
export const AUTH_GRANT_HEADER = 'x-cs-auth-grant';

const GRANT_TTL_SECONDS = 60;
const MAX_GRANT_CHARS = 7000;

const billingStatusSchema = z.enum(['trialing', 'active', 'past_due', 'canceled']);
const tenantRoleSchema = z.enum(['owner', 'admin', 'employee', 'viewer']);

const factorSchema = z.object({
  id: z.string().min(1),
  factorType: z.enum(['totp', 'phone', 'webauthn']),
  status: z.literal('verified'),
});

const tenantSchema = z.object({
  tenantId: z.string().min(1),
  tenantSlug: z.string().min(1),
  tenantName: z.string(),
  role: tenantRoleSchema,
  roleId: z.string().nullable(),
  adminSuspended: z.boolean(),
  connectStatus: z.string().nullable(),
  tenantIsActive: z.boolean(),
  billingStatus: billingStatusSchema.nullable(),
  trialEndsAt: z.string().nullable(),
  activatedAt: z.string().nullable(),
  canceledAt: z.string().nullable(),
  stripeSubscriptionId: z.string().nullable(),
});

const grantSchema = z.object({
  v: z.literal(1),
  exp: z.number().int(),
  sid: z.string().min(1),
  uid: z.string().min(1),
  email: z.string().nullable(),
  appMetadata: z.record(z.string(), z.unknown()),
  userMetadata: z.record(z.string(), z.unknown()),
  aal: z.enum(['aal1', 'aal2']).nullable(),
  amr: z.array(z.string()),
  factors: z.array(factorSchema).max(8),
  tenant: tenantSchema.nullable(),
});

export type RequestAuthGrant = z.infer<typeof grantSchema>;
export type RequestAuthGrantTenant = z.infer<typeof tenantSchema>;

export interface IssueRequestAuthGrantInput {
  user: User;
  accessToken: string;
  tenant: RequestAuthGrantTenant | null;
  secret: string;
  nowSeconds?: number;
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  try {
    const cloned = JSON.parse(JSON.stringify(value)) as unknown;
    if (!cloned || typeof cloned !== 'object' || Array.isArray(cloned)) return {};
    return cloned as Record<string, unknown>;
  } catch {
    return null;
  }
}

function verifiedFactors(user: User): z.infer<typeof factorSchema>[] {
  const factors: z.infer<typeof factorSchema>[] = [];
  for (const factor of user.factors ?? []) {
    if (factor.status !== 'verified') continue;
    if (
      factor.factor_type !== 'totp' &&
      factor.factor_type !== 'phone' &&
      factor.factor_type !== 'webauthn'
    ) {
      continue;
    }
    factors.push({
      id: factor.id,
      factorType: factor.factor_type,
      status: 'verified',
    });
    if (factors.length >= 8) break;
  }
  return factors;
}

function signBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

/**
 * Signed snapshot of the user (and tenant workspace, when already loaded) so
 * later server code in the same request can skip another Auth round trip.
 * Returns null when the snapshot cannot be bound to the session or is too large.
 */
export function issueRequestAuthGrant(input: IssueRequestAuthGrantInput): string | null {
  const sid = sessionIdFromAccessToken(input.accessToken);
  if (!sid || !input.secret) return null;

  const appMetadata = jsonRecord(input.user.app_metadata);
  const userMetadata = jsonRecord(input.user.user_metadata);
  if (!appMetadata || !userMetadata) return null;

  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const parsed = grantSchema.safeParse({
    v: 1,
    exp: nowSeconds + GRANT_TTL_SECONDS,
    sid,
    uid: input.user.id,
    email: input.user.email ?? null,
    appMetadata,
    userMetadata,
    aal: aalFromAccessToken(input.accessToken),
    amr: amrMethodsFromAccessToken(input.accessToken),
    factors: verifiedFactors(input.user),
    tenant: input.tenant,
  });
  if (!parsed.success) return null;

  const body = Buffer.from(JSON.stringify(parsed.data), 'utf8').toString('base64url');
  const token = `${body}.${signBody(body, input.secret)}`;
  if (token.length > MAX_GRANT_CHARS) return null;
  return token;
}

/** Verifies the proxy signature, expiry, and that the grant belongs to this session. */
export function verifyRequestAuthGrant(
  token: string,
  secret: string,
  sessionId: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): RequestAuthGrant | null {
  if (!token || !secret || !sessionId) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!body || !signature) return null;

  const expected = signBody(body, secret);
  const actualBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (actualBuf.length !== expectedBuf.length || !timingSafeEqual(actualBuf, expectedBuf)) {
    return null;
  }

  let json: unknown;
  try {
    json = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const parsed = grantSchema.safeParse(json);
  if (!parsed.success) return null;
  if (parsed.data.exp < nowSeconds) return null;
  if (parsed.data.sid !== sessionId) return null;
  return parsed.data;
}

export function userFromGrant(grant: RequestAuthGrant): User {
  const factors: Factor[] = grant.factors.map((factor) => ({
    id: factor.id,
    factor_type: factor.factorType,
    status: 'verified',
    created_at: '',
    updated_at: '',
  }));

  return {
    id: grant.uid,
    aud: 'authenticated',
    role: 'authenticated',
    email: grant.email ?? undefined,
    app_metadata: grant.appMetadata,
    user_metadata: grant.userMetadata,
    created_at: '',
    factors,
  };
}
