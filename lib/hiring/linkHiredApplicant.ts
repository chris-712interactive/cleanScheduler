import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

/** When a team invite from the hiring desk is accepted, keep the applicant name on the profile. */
export async function linkHiredApplicant(
  admin: Admin,
  inviteToken: string,
  userId: string,
): Promise<void> {
  const { data: application } = await admin
    .from('tenant_hiring_applications')
    .select('id, tenant_id, opening_id, full_name')
    .eq('invite_token', inviteToken)
    .maybeSingle();
  if (!application) return;

  await admin
    .from('tenant_hiring_applications')
    .update({ hired_user_id: userId })
    .eq('id', application.id);

  if (application.full_name?.trim()) {
    await admin
      .from('user_profiles')
      .update({ display_name: application.full_name.trim() })
      .eq('user_id', userId);
  }

  await admin.from('tenant_hiring_events').insert({
    tenant_id: application.tenant_id,
    opening_id: application.opening_id,
    application_id: application.id,
    event_type: 'hired',
    actor_user_id: userId,
    detail: 'invite_accepted',
  });
}
