/**
 * Manual demotion of tenant users stamped with platform app_role admin.
 *
 * This file is not a migration and is not invoked by CI, deploy, or npm scripts.
 * Run it only by hand:
 *   node --experimental-strip-types scripts/demote-mislabeled-platform-admins.mts
 * With no opt-in it prints usage and changes nothing.
 *
 * All of the following must be set together or the script refuses to connect:
 * - command argument `--apply`
 * - CONFIRM_PLATFORM_ADMIN_DEMOTION=demote-tenant-platform-admins
 * - PLATFORM_STAFF_ALLOWLIST=<user uuid>[,<user uuid>...]
 * - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
 *
 * Allowlisted user ids keep platform admin. Everyone else is demoted only when
 * user_profiles.app_role is admin AND they have a tenant membership. super_admin,
 * sales, and admin users with no membership are left alone. Auth metadata is
 * changed only when its app_role is admin.
 */
import { createClient } from '@supabase/supabase-js';
import {
  parseStaffAllowlist,
  shouldDemoteMislabeledPlatformAdmin,
} from '../lib/auth/platformAdminDemotion.ts';

const CONFIRM_VALUE = 'demote-tenant-platform-admins';

function usage(): string {
  return [
    'This script does not change data unless you opt in.',
    'Required together:',
    '  --apply',
    `  CONFIRM_PLATFORM_ADMIN_DEMOTION=${CONFIRM_VALUE}`,
    '  PLATFORM_STAFF_ALLOWLIST=<user uuid>[,<user uuid>...]',
    '  NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment',
    'An empty or invalid allowlist is rejected so staff are not demoted by accident.',
    'The allowlist is the set of user ids that must keep platform admin.',
  ].join('\n');
}

function refuse(message: string): never {
  console.error(message);
  process.exit(2);
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const confirmed = process.env.CONFIRM_PLATFORM_ADMIN_DEMOTION === CONFIRM_VALUE;
  const allowlist = parseStaffAllowlist(process.env.PLATFORM_STAFF_ALLOWLIST);

  if (!apply || !confirmed || !allowlist) {
    console.log(usage());
    const partial =
      apply ||
      Boolean(process.env.CONFIRM_PLATFORM_ADMIN_DEMOTION) ||
      Boolean(process.env.PLATFORM_STAFF_ALLOWLIST);
    if (partial) {
      refuse(
        'Refusing to run: --apply, the confirm value, and a non-empty user-id allowlist are all required.',
      );
    }
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    refuse(
      'Refusing to run: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.',
    );
  }

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const pageSize = 500;
  let from = 0;
  let scanned = 0;
  let demoted = 0;
  let keptAllowlisted = 0;
  let skippedNoMembership = 0;
  let skippedAuthRole = 0;

  for (;;) {
    const { data, error } = await admin
      .from('user_profiles')
      .select('user_id, app_role')
      .eq('app_role', 'admin')
      .range(from, from + pageSize - 1);
    if (error) refuse(error.message);
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      const userId = typeof row.user_id === 'string' ? row.user_id : '';
      if (!userId) continue;
      scanned += 1;

      const { count, error: countError } = await admin
        .from('tenant_memberships')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId);
      if (countError) refuse(countError.message);

      const demote = shouldDemoteMislabeledPlatformAdmin({
        appRole: typeof row.app_role === 'string' ? row.app_role : null,
        hasTenantMembership: (count ?? 0) > 0,
        userId,
        allowlist,
      });
      if (!demote) {
        if (allowlist.has(userId.toLowerCase())) keptAllowlisted += 1;
        else skippedNoMembership += 1;
        continue;
      }

      const { data: userRes, error: userErr } = await admin.auth.admin.getUserById(userId);
      if (userErr || !userRes.user) refuse(userErr?.message ?? 'Auth user could not be loaded.');
      const meta = { ...(userRes.user.app_metadata ?? {}) };
      const authRole = meta.app_role;
      if (authRole === 'super_admin' || authRole === 'sales') {
        skippedAuthRole += 1;
        continue;
      }
      if (authRole === 'admin') {
        meta.app_role = 'employee';
        const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
          app_metadata: meta,
        });
        if (metaErr) refuse(metaErr.message);
      }

      const { error: profileErr } = await admin
        .from('user_profiles')
        .update({ app_role: 'employee', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('app_role', 'admin');
      if (profileErr) refuse(profileErr.message);
      demoted += 1;
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  console.log(
    `Scanned ${scanned} profiles labeled admin. Demoted ${demoted}. Allowlisted ${keptAllowlisted}. Left without a tenant membership ${skippedNoMembership}. Left because auth role was not admin ${skippedAuthRole}.`,
  );
}

void main();
