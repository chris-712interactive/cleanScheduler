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
 * Allowlisted user ids keep their platform role. Put every real platform
 * admin, super admin, and sales user on that list before you run this,
 * including staff who also belong to a workspace.
 * Everyone else is demoted when user_profiles.app_role is admin, super_admin,
 * or sales AND they have a tenant membership (inactive memberships count).
 * The same labels with no membership are left alone. Auth app_metadata.app_role
 * is set to employee when it is admin, super_admin, or sales. Any other Auth
 * role is left unchanged, and the profile label is still set to employee.
 */
import { createClient } from '@supabase/supabase-js';
import {
  MISLABELED_TENANT_PLATFORM_ROLES,
  demoteAuthAppRole,
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
    'The allowlist is the set of user ids that must keep platform admin, super admin, or sales.',
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
  let afterUserId = '';
  let scanned = 0;
  let demoted = 0;
  let keptAllowlisted = 0;
  let skippedNoMembership = 0;
  let skippedAuthRole = 0;

  for (;;) {
    let query = admin
      .from('user_profiles')
      .select('user_id, app_role')
      .in('app_role', [...MISLABELED_TENANT_PLATFORM_ROLES])
      .order('user_id', { ascending: true })
      .limit(pageSize);
    if (afterUserId) query = query.gt('user_id', afterUserId);
    const { data, error } = await query;
    if (error) refuse(error.message);
    const rows = data ?? [];
    if (rows.length === 0) break;
    const lastUserId = rows[rows.length - 1]?.user_id;
    if (typeof lastUserId !== 'string' || lastUserId.length === 0) {
      refuse('Refusing to continue: a profile page did not end with a user id.');
    }
    afterUserId = lastUserId;

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
      const authRole = typeof meta.app_role === 'string' ? meta.app_role : null;
      const authDecision = demoteAuthAppRole(authRole);
      if (authDecision.nextAuthRole) {
        meta.app_role = authDecision.nextAuthRole;
        const { error: metaErr } = await admin.auth.admin.updateUserById(userId, {
          app_metadata: meta,
        });
        if (metaErr) refuse(metaErr.message);
      } else if (authDecision.authRoleUnrecognized) {
        skippedAuthRole += 1;
      }

      const { error: profileErr } = await admin
        .from('user_profiles')
        .update({ app_role: 'employee', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .in('app_role', [...MISLABELED_TENANT_PLATFORM_ROLES]);
      if (profileErr) refuse(profileErr.message);
      demoted += 1;
    }

    if (rows.length < pageSize) break;
  }

  console.log(
    `Scanned ${scanned} profiles labeled admin, super_admin, or sales. Demoted ${demoted}. Allowlisted ${keptAllowlisted}. Left without a tenant membership ${skippedNoMembership}. Profile demoted and Auth left unchanged because its role was unrecognized ${skippedAuthRole}.`,
  );
}

void main();
