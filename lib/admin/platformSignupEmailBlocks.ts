import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import { recordPlatformAuditEvent } from '@/lib/audit/recordPlatformAuditEvent';

type Admin = SupabaseClient<Database>;

export const SIGNUP_EMAIL_BLOCKED_AUDIT = 'signup.email_blocked';
export const SIGNUP_EMAIL_UNBLOCKED_AUDIT = 'signup.email_unblocked';

export const SIGNUP_EMAIL_BLOCKED_MESSAGE =
  'This email address cannot create a new workspace. Contact support if you believe this is an error.';

export type SignupEmailBlockSource = 'manual' | 'admin_tenant' | 'fraud';

export function normalizeSignupEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidSignupEmail(email: string): boolean {
  const normalized = normalizeSignupEmail(email);
  return normalized.includes('@') && normalized.length >= 5 && normalized.length <= 320;
}

export async function isSignupEmailBlocked(admin: Admin, email: string): Promise<boolean> {
  const normalized = normalizeSignupEmail(email);
  if (!normalized) return false;

  const { data, error } = await admin
    .from('platform_signup_email_blocks')
    .select('id')
    .eq('email_normalized', normalized)
    .maybeSingle();

  if (error) {
    console.error('[signup-email-block] lookup failed:', error.message);
    // Fail closed for fraud control when the table exists but query fails.
    // If migration is missing, Postgres/PostgREST returns an error — fail open so signup still works.
    const missing =
      /does not exist|Could not find the table|schema cache/i.test(error.message) ||
      error.code === '42P01' ||
      error.code === 'PGRST205';
    if (missing) return false;
    return true;
  }

  return Boolean(data?.id);
}

/** True if any of the provided emails is blocked. */
export async function isAnySignupEmailBlocked(
  admin: Admin,
  emails: Array<string | null | undefined>,
): Promise<boolean> {
  const unique = [
    ...new Set(
      emails.map((e) => (e ? normalizeSignupEmail(e) : '')).filter((e) => e.includes('@')),
    ),
  ];
  for (const email of unique) {
    if (await isSignupEmailBlocked(admin, email)) return true;
  }
  return false;
}

export async function blockSignupEmail(
  admin: Admin,
  options: {
    email: string;
    actorUserId: string;
    reason?: string | null;
    source?: SignupEmailBlockSource;
    sourceTenantId?: string | null;
    sourceTenantSlug?: string | null;
  },
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const email = normalizeSignupEmail(options.email);
  if (!isValidSignupEmail(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const reason = options.reason?.trim().slice(0, 500) || null;
  const source = options.source ?? 'manual';

  const { error } = await admin.from('platform_signup_email_blocks').upsert(
    {
      email_normalized: email,
      reason,
      source,
      source_tenant_id: options.sourceTenantId ?? null,
      source_tenant_slug: options.sourceTenantSlug ?? null,
      created_by_user_id: options.actorUserId,
    },
    { onConflict: 'email_normalized' },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordPlatformAuditEvent(admin, {
    actorUserId: options.actorUserId,
    action: SIGNUP_EMAIL_BLOCKED_AUDIT,
    targetTenantId: options.sourceTenantId ?? null,
    payload: {
      email,
      reason,
      source,
      source_tenant_slug: options.sourceTenantSlug ?? null,
    },
  });

  return { ok: true, email };
}

export async function unblockSignupEmail(
  admin: Admin,
  options: {
    email: string;
    actorUserId: string;
  },
): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const email = normalizeSignupEmail(options.email);
  if (!isValidSignupEmail(email)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }

  const { data: existing } = await admin
    .from('platform_signup_email_blocks')
    .select('id, source_tenant_id')
    .eq('email_normalized', email)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: 'That email is not on the signup block list.' };
  }

  const { error } = await admin
    .from('platform_signup_email_blocks')
    .delete()
    .eq('email_normalized', email);

  if (error) {
    return { ok: false, error: error.message };
  }

  await recordPlatformAuditEvent(admin, {
    actorUserId: options.actorUserId,
    action: SIGNUP_EMAIL_UNBLOCKED_AUDIT,
    targetTenantId: existing.source_tenant_id ?? null,
    payload: { email },
  });

  return { ok: true, email };
}

export type SignupEmailBlockRow = {
  id: string;
  emailNormalized: string;
  reason: string | null;
  source: string;
  sourceTenantId: string | null;
  sourceTenantSlug: string | null;
  createdByUserId: string | null;
  createdAt: string;
};

export async function listSignupEmailBlocks(
  admin: Admin,
  options?: { limit?: number },
): Promise<SignupEmailBlockRow[]> {
  const limit = options?.limit ?? 200;
  const { data, error } = await admin
    .from('platform_signup_email_blocks')
    .select(
      'id, email_normalized, reason, source, source_tenant_id, source_tenant_slug, created_by_user_id, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[signup-email-block] list failed:', error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    emailNormalized: row.email_normalized,
    reason: row.reason,
    source: row.source,
    sourceTenantId: row.source_tenant_id,
    sourceTenantSlug: row.source_tenant_slug,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
  }));
}
