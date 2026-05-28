'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/server';
import { requireTenantPortalAccess } from '@/lib/auth/tenantAccess';
import { getAuthContext } from '@/lib/auth/session';
import { canManageTeamInvitesAndRoles } from '@/lib/tenant/employeePermissions';
import {
  assertCanAddIntegration,
  assertTenantIntegrationsAllowed,
  integrationGateErrorMessage,
} from '@/lib/integrations/integrationLimits';
import {
  generateApiKeyMaterial,
  generateWebhookSigningSecret,
} from '@/lib/integrations/integrationSecrets';
import { parseWebhookEventTypesFromForm } from '@/lib/integrations/tenantWebhookEvents';
import { emitTenantWebhook } from '@/lib/integrations/emitTenantWebhook';
import { recordPlatformAuditEvent } from '@/lib/audit/recordPlatformAuditEvent';

export interface IntegrationActionState {
  error?: string;
  success?: boolean;
  createdApiKey?: string;
  createdSigningSecret?: string;
}

function parseWebhookUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const localhost =
      url.hostname === 'localhost' ||
      url.hostname === '127.0.0.1' ||
      url.hostname.endsWith('.localhost');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export async function createTenantApiKeyAction(
  _prev: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const name = String(formData.get('name') ?? '').trim();
  if (!slug) return { error: 'Workspace is required.' };
  if (!name) return { error: 'Key name is required.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/integrations');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage API keys.' };
  }

  const auth = await getAuthContext();
  if (!auth?.user.id) return { error: 'You must be signed in.' };

  const admin = createAdminClient();
  try {
    await assertCanAddIntegration(admin, membership.tenantId);
  } catch (error) {
    return { error: integrationGateErrorMessage(error) ?? 'Cannot create API key.' };
  }

  const material = generateApiKeyMaterial();
  const { error } = await admin.from('tenant_api_keys').insert({
    tenant_id: membership.tenantId,
    name,
    key_prefix: material.keyPrefix,
    key_hash: material.keyHash,
    created_by_user_id: auth.user.id,
  });

  if (error) return { error: error.message };

  await recordPlatformAuditEvent(admin, {
    actorUserId: auth.user.id,
    action: 'integration.api_key_created',
    targetTenantId: membership.tenantId,
    payload: { name, key_prefix: material.keyPrefix },
  });

  revalidatePath('/tenant/settings/integrations', 'page');
  return { success: true, createdApiKey: material.fullKey };
}

export async function revokeTenantApiKeyAction(
  _prev: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const keyId = String(formData.get('key_id') ?? '').trim();
  if (!slug || !keyId) return { error: 'Missing workspace or key.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/integrations');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage API keys.' };
  }

  const auth = await getAuthContext();
  if (!auth?.user.id) return { error: 'You must be signed in.' };

  const admin = createAdminClient();
  try {
    await assertTenantIntegrationsAllowed(admin, membership.tenantId);
  } catch (error) {
    return { error: integrationGateErrorMessage(error) ?? 'Cannot revoke API key.' };
  }

  const { error } = await admin
    .from('tenant_api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('tenant_id', membership.tenantId)
    .eq('id', keyId)
    .is('revoked_at', null);

  if (error) return { error: error.message };

  await recordPlatformAuditEvent(admin, {
    actorUserId: auth.user.id,
    action: 'integration.api_key_revoked',
    targetTenantId: membership.tenantId,
    payload: { key_id: keyId },
  });

  revalidatePath('/tenant/settings/integrations', 'page');
  return { success: true };
}

export async function createTenantWebhookEndpointAction(
  _prev: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const description = String(formData.get('description') ?? '').trim();
  const urlRaw = String(formData.get('url') ?? '').trim();
  const eventTypes = parseWebhookEventTypesFromForm(formData);

  if (!slug) return { error: 'Workspace is required.' };
  const url = parseWebhookUrl(urlRaw);
  if (!url) return { error: 'Enter a valid HTTPS webhook URL (HTTP allowed for localhost).' };
  if (eventTypes.length === 0) return { error: 'Select at least one event type.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/integrations');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage webhooks.' };
  }

  const auth = await getAuthContext();
  if (!auth?.user.id) return { error: 'You must be signed in.' };

  const admin = createAdminClient();
  try {
    await assertCanAddIntegration(admin, membership.tenantId);
  } catch (error) {
    return { error: integrationGateErrorMessage(error) ?? 'Cannot create webhook.' };
  }

  const signing = generateWebhookSigningSecret();
  const { error } = await admin.from('tenant_webhook_endpoints').insert({
    tenant_id: membership.tenantId,
    url,
    description: description || null,
    signing_secret: signing.secret,
    signing_secret_prefix: signing.prefix,
    event_types: eventTypes,
    created_by_user_id: auth.user.id,
  });

  if (error) return { error: error.message };

  revalidatePath('/tenant/settings/integrations', 'page');
  return { success: true, createdSigningSecret: signing.secret };
}

export async function deleteTenantWebhookEndpointAction(
  _prev: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const endpointId = String(formData.get('endpoint_id') ?? '').trim();
  if (!slug || !endpointId) return { error: 'Missing workspace or endpoint.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/integrations');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage webhooks.' };
  }

  const admin = createAdminClient();
  try {
    await assertTenantIntegrationsAllowed(admin, membership.tenantId);
  } catch (error) {
    return { error: integrationGateErrorMessage(error) ?? 'Cannot delete webhook.' };
  }

  const { error } = await admin
    .from('tenant_webhook_endpoints')
    .delete()
    .eq('tenant_id', membership.tenantId)
    .eq('id', endpointId);

  if (error) return { error: error.message };

  revalidatePath('/tenant/settings/integrations', 'page');
  return { success: true };
}

export async function toggleTenantWebhookEndpointAction(
  _prev: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const endpointId = String(formData.get('endpoint_id') ?? '').trim();
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  if (!slug || !endpointId) return { error: 'Missing workspace or endpoint.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/integrations');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can manage webhooks.' };
  }

  const admin = createAdminClient();
  try {
    await assertTenantIntegrationsAllowed(admin, membership.tenantId);
  } catch (error) {
    return { error: integrationGateErrorMessage(error) ?? 'Cannot update webhook.' };
  }

  const { error } = await admin
    .from('tenant_webhook_endpoints')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('tenant_id', membership.tenantId)
    .eq('id', endpointId);

  if (error) return { error: error.message };

  revalidatePath('/tenant/settings/integrations', 'page');
  return { success: true };
}

export async function sendTenantWebhookTestAction(
  _prev: IntegrationActionState,
  formData: FormData,
): Promise<IntegrationActionState> {
  const slug = String(formData.get('tenant_slug') ?? '')
    .trim()
    .toLowerCase();
  const endpointId = String(formData.get('endpoint_id') ?? '').trim();
  if (!slug || !endpointId) return { error: 'Missing workspace or endpoint.' };

  const membership = await requireTenantPortalAccess(slug, '/settings/integrations');
  if (!canManageTeamInvitesAndRoles(membership.role)) {
    return { error: 'Only owners and admins can test webhooks.' };
  }

  const admin = createAdminClient();
  try {
    await assertTenantIntegrationsAllowed(admin, membership.tenantId);
  } catch (error) {
    return { error: integrationGateErrorMessage(error) ?? 'Cannot send test webhook.' };
  }

  const { data: endpoint } = await admin
    .from('tenant_webhook_endpoints')
    .select('id')
    .eq('tenant_id', membership.tenantId)
    .eq('id', endpointId)
    .maybeSingle();

  if (!endpoint) return { error: 'Webhook endpoint not found.' };

  await emitTenantWebhook({
    admin,
    tenantId: membership.tenantId,
    eventType: 'quote.sent',
    data: {
      quote_id: 'test_quote_id',
      customer_id: 'test_customer_id',
      title: 'Test webhook from cleanScheduler',
      status: 'sent',
      test: true,
    },
  });

  return { success: true };
}

export async function revokeTenantApiKeyFormAction(formData: FormData): Promise<void> {
  await revokeTenantApiKeyAction({}, formData);
}

export async function deleteTenantWebhookEndpointFormAction(formData: FormData): Promise<void> {
  await deleteTenantWebhookEndpointAction({}, formData);
}

export async function toggleTenantWebhookEndpointFormAction(formData: FormData): Promise<void> {
  await toggleTenantWebhookEndpointAction({}, formData);
}

export async function sendTenantWebhookTestFormAction(formData: FormData): Promise<void> {
  await sendTenantWebhookTestAction({}, formData);
}
