'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  TENANT_WEBHOOK_EVENT_LABELS,
  TENANT_WEBHOOK_EVENT_TYPES,
} from '@/lib/integrations/tenantWebhookEvents';
import {
  createTenantApiKeyAction,
  createTenantWebhookEndpointAction,
  deleteTenantWebhookEndpointFormAction,
  revokeTenantApiKeyFormAction,
  sendTenantWebhookTestFormAction,
  toggleTenantWebhookEndpointFormAction,
  type IntegrationActionState,
} from './actions';
import styles from '../settings.module.scss';

const initialState: IntegrationActionState = {};

function SecretReveal({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.secretReveal} role="status">
      <p className={styles.opsIntro}>
        <strong>{label}</strong> — copy now; it will not be shown again.
      </p>
      <code className={styles.secretCode}>{value}</code>
    </div>
  );
}

export function IntegrationsPanel({
  tenantSlug,
  canEdit,
  apiBaseUrl,
  integrationLimit,
  integrationUsed,
  apiKeys,
  webhookEndpoints,
}: {
  tenantSlug: string;
  canEdit: boolean;
  apiBaseUrl: string;
  integrationLimit: number;
  integrationUsed: number;
  apiKeys: Array<{
    id: string;
    name: string;
    key_prefix: string;
    last_used_at: string | null;
    created_at: string;
  }>;
  webhookEndpoints: Array<{
    id: string;
    url: string;
    description: string | null;
    signing_secret_prefix: string;
    event_types: string[];
    enabled: boolean;
    created_at: string;
  }>;
}) {
  const [keyState, keyAction, keyPending] = useActionState(createTenantApiKeyAction, initialState);
  const [webhookState, webhookAction, webhookPending] = useActionState(
    createTenantWebhookEndpointAction,
    initialState,
  );
  const [banner, setBanner] = useState<string | null>(null);

  useEffect(() => {
    if (keyState.error) setBanner(keyState.error);
    else if (webhookState.error) setBanner(webhookState.error);
    else if (keyState.success || webhookState.success) setBanner(null);
  }, [keyState, webhookState]);

  const atLimit = integrationUsed >= integrationLimit;

  return (
    <div className={styles.integrationsStack}>
      {banner ? (
        <p className={styles.opsError} role="alert">
          {banner}
        </p>
      ) : null}

      {keyState.createdApiKey ? (
        <SecretReveal label="New API key" value={keyState.createdApiKey} />
      ) : null}
      {webhookState.createdSigningSecret ? (
        <SecretReveal label="Webhook signing secret" value={webhookState.createdSigningSecret} />
      ) : null}

      <p className={styles.opsIntro}>
        REST API base: <code>{apiBaseUrl}</code>. Authenticate with{' '}
        <code>Authorization: Bearer cs_live_…</code>. Integrations used: {integrationUsed}/
        {integrationLimit} (active API keys + enabled webhooks).
      </p>

      <section className={styles.integrationsSection}>
        <h2 className={styles.integrationsHeading}>API keys</h2>
        {apiKeys.length === 0 ? (
          <p className={styles.opsIntro}>No API keys yet.</p>
        ) : (
          <ul className={styles.integrationsList}>
            {apiKeys.map((key) => (
              <li key={key.id} className={styles.integrationsListItem}>
                <div>
                  <strong>{key.name}</strong>
                  <span className={styles.integrationsMeta}>
                    {key.key_prefix}… · created {new Date(key.created_at).toLocaleDateString()}
                    {key.last_used_at
                      ? ` · last used ${new Date(key.last_used_at).toLocaleString()}`
                      : ''}
                  </span>
                </div>
                {canEdit ? (
                  <form action={revokeTenantApiKeyFormAction}>
                    <input type="hidden" name="tenant_slug" value={tenantSlug} />
                    <input type="hidden" name="key_id" value={key.id} />
                    <Button type="submit" size="sm" variant="secondary">
                      Revoke
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <form action={keyAction} className={styles.integrationsForm}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <label className={styles.opsField}>
              <span className={styles.opsLabel}>Key name</span>
              <input
                className={styles.opsInput}
                name="name"
                placeholder="Zapier production"
                required
                disabled={atLimit || keyPending}
              />
            </label>
            <Button type="submit" disabled={atLimit || keyPending}>
              {keyPending ? 'Creating…' : 'Create API key'}
            </Button>
          </form>
        ) : null}
      </section>

      <section className={styles.integrationsSection}>
        <h2 className={styles.integrationsHeading}>Outbound webhooks</h2>
        {webhookEndpoints.length === 0 ? (
          <p className={styles.opsIntro}>No webhook endpoints yet.</p>
        ) : (
          <ul className={styles.integrationsList}>
            {webhookEndpoints.map((endpoint) => (
              <li key={endpoint.id} className={styles.integrationsListItem}>
                <div>
                  <strong>{endpoint.description || endpoint.url}</strong>
                  <span className={styles.integrationsMeta}>
                    {endpoint.url} · secret {endpoint.signing_secret_prefix}… ·{' '}
                    {endpoint.enabled ? 'enabled' : 'disabled'}
                  </span>
                  <span className={styles.integrationsMeta}>
                    Events: {endpoint.event_types.join(', ') || 'none'}
                  </span>
                </div>
                {canEdit ? (
                  <div className={styles.integrationsActions}>
                    <form action={sendTenantWebhookTestFormAction}>
                      <input type="hidden" name="tenant_slug" value={tenantSlug} />
                      <input type="hidden" name="endpoint_id" value={endpoint.id} />
                      <Button type="submit" size="sm" variant="secondary">
                        Send test
                      </Button>
                    </form>
                    <form action={toggleTenantWebhookEndpointFormAction}>
                      <input type="hidden" name="tenant_slug" value={tenantSlug} />
                      <input type="hidden" name="endpoint_id" value={endpoint.id} />
                      <input
                        type="hidden"
                        name="enabled"
                        value={endpoint.enabled ? 'false' : 'true'}
                      />
                      <Button type="submit" size="sm" variant="secondary">
                        {endpoint.enabled ? 'Disable' : 'Enable'}
                      </Button>
                    </form>
                    <form action={deleteTenantWebhookEndpointFormAction}>
                      <input type="hidden" name="tenant_slug" value={tenantSlug} />
                      <input type="hidden" name="endpoint_id" value={endpoint.id} />
                      <Button type="submit" size="sm" variant="secondary">
                        Delete
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <form action={webhookAction} className={styles.integrationsForm}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <label className={styles.opsField}>
              <span className={styles.opsLabel}>HTTPS URL</span>
              <input
                className={styles.opsInput}
                name="url"
                type="url"
                placeholder="https://example.com/webhooks/cleanscheduler"
                required
                disabled={atLimit || webhookPending}
              />
            </label>
            <label className={styles.opsField}>
              <span className={styles.opsLabel}>Description (optional)</span>
              <input
                className={styles.opsInput}
                name="description"
                placeholder="Zapier — new quotes"
                disabled={atLimit || webhookPending}
              />
            </label>
            <fieldset className={styles.opsFieldset}>
              <legend className={styles.opsLegend}>Events</legend>
              <div className={styles.opsCheckboxGrid}>
                {TENANT_WEBHOOK_EVENT_TYPES.map((eventType) => (
                  <label key={eventType} className={styles.opsCheckbox}>
                    <input
                      type="checkbox"
                      name="event_types"
                      value={eventType}
                      disabled={atLimit || webhookPending}
                    />
                    <span>
                      {TENANT_WEBHOOK_EVENT_LABELS[eventType]} ({eventType})
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" disabled={atLimit || webhookPending}>
              {webhookPending ? 'Adding…' : 'Add webhook endpoint'}
            </Button>
          </form>
        ) : null}
      </section>
    </div>
  );
}
