'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth/session';
import { clearedMasqueradeAppMetadata } from '@/lib/auth/masqueradeSession';
import { getPublicOrigin } from '@/lib/portal/publicOrigin';
import { headers } from 'next/headers';
import {
  MASQUERADE_HANDOFF_TTL_MS,
  createMasqueradeHandoffToken,
  hashMasqueradeHandoffToken,
  masqueradeHandoffRedirect,
} from '@/lib/auth/masqueradeHandoff';

export async function startMasqueradeAction(formData: FormData): Promise<void> {
  const tenantSlug = String(formData.get('tenant_slug') ?? '').trim();
  const tenantId = String(formData.get('tenant_id') ?? '').trim();
  const admin = createAdminClient();
  const auth = await requireAuth('/tenants');

  if (!tenantSlug || !tenantId) {
    redirect('/tenants');
  }

  const role = auth.claims.appRole;
  if (role !== 'super_admin' && role !== 'admin') {
    redirect('/access-denied?reason=forbidden');
  }

  const { data: tenant, error: tErr } = await admin
    .from('tenants')
    .select('id, slug')
    .eq('id', tenantId)
    .maybeSingle();
  if (tErr || !tenant || tenant.slug !== tenantSlug) {
    redirect('/tenants');
  }

  const endedAt = new Date().toISOString();
  const { error: closeErr } = await admin
    .from('masquerade_sessions')
    .update({ ended_at: endedAt })
    .eq('admin_user_id', auth.user.id)
    .is('ended_at', null);
  if (closeErr) {
    redirect(`/tenants/${tenantSlug}?error=masquerade_session`);
  }

  const { data: insertedSession, error: sessionErr } = await admin
    .from('masquerade_sessions')
    .insert({
      admin_user_id: auth.user.id,
      target_tenant_id: tenantId,
    })
    .select('id')
    .single();
  if (sessionErr || !insertedSession) {
    redirect(`/tenants/${tenantSlug}?error=masquerade_session`);
  }

  const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(auth.user.id);
  if (uErr || !userRes.user) {
    redirect(`/tenants/${tenantSlug}?error=masquerade_user`);
  }

  const meta = { ...(userRes.user.app_metadata ?? {}) };
  meta.masquerade_target_tenant_id = tenantId;
  meta.current_tenant_id = tenantId;

  const { error: upErr } = await admin.auth.admin.updateUserById(auth.user.id, {
    app_metadata: meta,
  });

  if (upErr) {
    redirect(`/tenants/${tenantSlug}?error=masquerade_update`);
  }

  const handoffToken = createMasqueradeHandoffToken();
  const { error: handoffErr } = await admin.from('masquerade_handoff_tokens').insert({
    token_hash: hashMasqueradeHandoffToken(handoffToken),
    admin_user_id: auth.user.id,
    target_tenant_id: tenantId,
    masquerade_session_id: insertedSession.id,
    expires_at: new Date(Date.now() + MASQUERADE_HANDOFF_TTL_MS).toISOString(),
  });
  if (handoffErr) {
    redirect(`/tenants/${tenantSlug}?error=masquerade_handoff`);
  }

  await admin.from('audit_log_entries').insert({
    actor_user_id: auth.user.id,
    action: 'masquerade.start',
    target_tenant_id: tenantId,
    payload: { tenant_slug: tenantSlug },
  });

  redirect(masqueradeHandoffRedirect(getPublicOrigin(tenantSlug), handoffToken));
}

export async function endMasqueradeAction(): Promise<void> {
  const admin = createAdminClient();
  const auth = await requireAuth('/');

  const role = auth.claims.appRole;
  if (role !== 'super_admin' && role !== 'admin') {
    redirect('/access-denied?reason=forbidden');
  }

  const targetTenantId = auth.claims.masqueradeTargetTenantId;

  await admin
    .from('masquerade_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('admin_user_id', auth.user.id)
    .is('ended_at', null);

  await admin.from('audit_log_entries').insert({
    actor_user_id: auth.user.id,
    action: 'masquerade.end',
    target_tenant_id: targetTenantId,
    payload: {},
  });

  const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(auth.user.id);
  if (uErr || !userRes.user) {
    redirect(`${getPublicOrigin('admin')}/tenants`);
  }

  const meta = clearedMasqueradeAppMetadata({ ...(userRes.user.app_metadata ?? {}) });

  await admin.auth.admin.updateUserById(auth.user.id, { app_metadata: meta });

  const h = await headers();
  const portal = h.get('x-portal');
  if (portal === 'tenant') {
    redirect(`${getPublicOrigin('admin')}/tenants`);
  }
  redirect('/tenants');
}
