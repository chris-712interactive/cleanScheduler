import type { SupabaseClient } from '@supabase/supabase-js';
import { assertFeatureEnabled, resolveTenantPlanTier } from '@/lib/billing/entitlements';
import { canUsePaidSubscriptionFeatures } from '@/lib/billing/tenantSubscriptionAccess';
import type { Database } from '@/lib/supabase/database.types';
import { hashIntegrationSecret } from '@/lib/integrations/integrationSecrets';

export type TenantApiAuthContext = {
  tenantId: string;
  apiKeyId: string;
};

function parseBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization')?.trim();
  if (!auth?.toLowerCase().startsWith('bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

export async function authenticateTenantApiRequest(
  admin: SupabaseClient<Database>,
  request: Request,
): Promise<TenantApiAuthContext | { error: string; status: number }> {
  const token = parseBearerToken(request);
  if (!token) {
    return { error: 'Missing Authorization: Bearer API key.', status: 401 };
  }

  if (!token.startsWith('cs_live_')) {
    return { error: 'Invalid API key format.', status: 401 };
  }

  const keyHash = hashIntegrationSecret(token);
  const { data: keyRow, error } = await admin
    .from('tenant_api_keys')
    .select('id, tenant_id, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle();

  if (error) {
    return { error: 'Could not validate API key.', status: 500 };
  }

  if (!keyRow || keyRow.revoked_at) {
    return { error: 'Invalid or revoked API key.', status: 401 };
  }

  const [{ data: billing }, tier] = await Promise.all([
    admin
      .from('tenant_billing_accounts')
      .select('status')
      .eq('tenant_id', keyRow.tenant_id)
      .maybeSingle(),
    resolveTenantPlanTier(admin, keyRow.tenant_id),
  ]);

  try {
    assertFeatureEnabled(tier, 'fullApiWebhooks');
  } catch {
    return {
      error: 'Pro plan required for API access. Upgrade your subscription to continue.',
      status: 403,
    };
  }

  if (!canUsePaidSubscriptionFeatures(billing?.status)) {
    return {
      error: 'API access requires a paid Pro subscription. Subscribe to unlock the REST API.',
      status: 403,
    };
  }

  void admin
    .from('tenant_api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRow.id);

  return { tenantId: keyRow.tenant_id, apiKeyId: keyRow.id };
}
