'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import {
  TENANT_WEBHOOK_EVENT_LABELS,
  TENANT_WEBHOOK_EVENT_TYPES,
  type TenantWebhookEventType,
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
import styles from './integrations-settings.module.scss';

const initialState: IntegrationActionState = {};

const API_DATA_TYPES = ['Customers', 'Quotes', 'Visits', 'Invoices'] as const;

function CopyValueButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      className={styles.copyButton}
      data-copied={copied ? 'true' : undefined}
      onClick={() => void copy()}
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function SecretReveal({ title, lead, value }: { title: string; lead: string; value: string }) {
  return (
    <div className={styles.secretReveal} role="status">
      <p className={styles.secretTitle}>{title}</p>
      <p className={styles.secretLead}>{lead}</p>
      <div className={styles.secretValueRow}>
        <code className={styles.secretCode}>{value}</code>
        <CopyValueButton value={value} label={title} />
      </div>
    </div>
  );
}

function formatEventTypes(eventTypes: string[]): string {
  if (eventTypes.includes('*')) return 'All events';
  return eventTypes
    .map(
      (eventType) => TENANT_WEBHOOK_EVENT_LABELS[eventType as TenantWebhookEventType] ?? eventType,
    )
    .join(' · ');
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
  const activeWebhooks = webhookEndpoints.filter((endpoint) => endpoint.enabled).length;

  return (
    <div className={styles.integrationsStack}>
      {!canEdit ? (
        <p className={styles.readOnlyNotice} role="status">
          You can view integration settings here. Only owners and admins can create or change
          connections.
        </p>
      ) : null}

      {banner ? (
        <p className={styles.bannerError} role="alert">
          {banner}
        </p>
      ) : null}

      {keyState.createdApiKey ? (
        <SecretReveal
          title="Your new API key"
          lead="Copy this key now and store it somewhere safe. For security, we cannot show it again."
          value={keyState.createdApiKey}
        />
      ) : null}
      {webhookState.createdSigningSecret ? (
        <SecretReveal
          title="Your webhook signing secret"
          lead="Give this to your developer so they can verify messages came from Clean Scheduler. We only show it once."
          value={webhookState.createdSigningSecret}
        />
      ) : null}

      <header className={styles.hero}>
        <h2 className={styles.heroTitle}>Connect your other tools</h2>
        <p className={styles.heroLead}>
          Use <strong>API keys</strong> when another app needs to read your workspace data — for
          example Zapier or a custom script. Use <strong>webhooks</strong> when you want your own
          system notified automatically when quotes, visits, or invoices change.
        </p>
        <div className={styles.heroMeta}>
          <span className={styles.metaChip}>
            {integrationUsed} of {integrationLimit} connections used
          </span>
          <span className={styles.metaChip}>
            {apiKeys.length} API {apiKeys.length === 1 ? 'key' : 'keys'}
          </span>
          <span className={styles.metaChip}>
            {activeWebhooks} active {activeWebhooks === 1 ? 'webhook' : 'webhooks'}
          </span>
        </div>
        <nav className={styles.pathGrid} aria-label="Integration options">
          <a className={styles.pathCard} href="#integrations-api">
            <p className={styles.pathEyebrow}>Option 1</p>
            <p className={styles.pathTitle}>Pull data with an API key</p>
            <p className={styles.pathHint}>
              Best for Zapier, spreadsheets, or developer-built tools.
            </p>
          </a>
          <a className={styles.pathCard} href="#integrations-webhooks">
            <p className={styles.pathEyebrow}>Option 2</p>
            <p className={styles.pathTitle}>Get notified with webhooks</p>
            <p className={styles.pathHint}>
              Best when your backend should react the moment something happens.
            </p>
          </a>
        </nav>
      </header>

      {atLimit ? (
        <p className={styles.bannerWarning} role="status">
          You have reached your plan limit of {integrationLimit} active connections (API keys plus
          enabled webhooks). Revoke an unused key or disable a webhook before adding another.
        </p>
      ) : null}

      <nav className={styles.sectionNav} aria-label="On this page">
        <a className={styles.sectionNavLink} href="#integrations-api">
          API access
        </a>
        <a className={styles.sectionNavLink} href="#integrations-webhooks">
          Webhooks
        </a>
      </nav>

      <section className={styles.settingsSection} id="integrations-api">
        <header className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Option 1</p>
          <h3 className={styles.sectionTitle}>API access</h3>
          <p className={styles.sectionLead}>
            Create a key and share it with the tool or developer that needs read access to your
            workspace. Each key can be revoked at any time.
          </p>
        </header>

        <div>
          <p className={styles.technicalLabel}>Data you can read</p>
          <div className={styles.dataGrid}>
            {API_DATA_TYPES.map((label) => (
              <div key={label} className={styles.dataTile}>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.technicalCard}>
          <p className={styles.technicalLabel}>API base URL</p>
          <div className={styles.technicalRow}>
            <code className={styles.technicalValue}>{apiBaseUrl}</code>
            <CopyValueButton value={apiBaseUrl} label="API base URL" />
          </div>
          <p className={styles.technicalHint}>
            Your developer or integration tool will ask for this address plus an API key. Send the
            key in an <code>Authorization: Bearer</code> header.
          </p>
        </div>

        {apiKeys.length === 0 ? (
          <p className={styles.emptyState}>
            No API keys yet. Create one when you connect Zapier or another tool that needs to read
            your data.
          </p>
        ) : (
          <ul className={styles.itemList}>
            {apiKeys.map((key) => (
              <li key={key.id} className={styles.itemCard}>
                <div className={styles.itemMain}>
                  <p className={styles.itemTitle}>{key.name}</p>
                  <p className={styles.itemMeta}>
                    Key starts with {key.key_prefix}… · Created {formatDate(key.created_at)}
                    {key.last_used_at ? ` · Last used ${formatDateTime(key.last_used_at)}` : ''}
                  </p>
                </div>
                {canEdit ? (
                  <div className={styles.itemActions}>
                    <form action={revokeTenantApiKeyFormAction}>
                      <input type="hidden" name="tenant_slug" value={tenantSlug} />
                      <input type="hidden" name="key_id" value={key.id} />
                      <Button type="submit" size="sm" variant="secondary">
                        Revoke
                      </Button>
                    </form>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canEdit ? (
          <div className={styles.setupCard}>
            <p className={styles.setupTitle}>Create a new API key</p>
            <form action={keyAction}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Key name</span>
                <span className={styles.fieldHint}>
                  Use a name you will recognize later, like &ldquo;Zapier production&rdquo;.
                </span>
                <input
                  className={styles.textInput}
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
          </div>
        ) : null}
      </section>

      <section className={styles.settingsSection} id="integrations-webhooks">
        <header className={styles.sectionHeader}>
          <p className={styles.sectionEyebrow}>Option 2</p>
          <h3 className={styles.sectionTitle}>Webhooks</h3>
          <p className={styles.sectionLead}>
            Tell us where to send updates. When something happens in Clean Scheduler, we POST a
            signed message to your HTTPS URL.
          </p>
        </header>

        {webhookEndpoints.length === 0 ? (
          <p className={styles.emptyState}>
            No webhooks yet. Add an endpoint when you want your own system notified automatically.
          </p>
        ) : (
          <ul className={styles.itemList}>
            {webhookEndpoints.map((endpoint) => (
              <li key={endpoint.id} className={styles.itemCard}>
                <div className={styles.itemMain}>
                  <p className={styles.itemTitle}>{endpoint.description || endpoint.url}</p>
                  <p className={styles.itemMeta}>{endpoint.url}</p>
                  <p className={styles.itemMeta}>
                    Signing secret starts with {endpoint.signing_secret_prefix}… · Created{' '}
                    {formatDate(endpoint.created_at)}
                  </p>
                  <p className={styles.itemMeta}>
                    Notifications: {formatEventTypes(endpoint.event_types) || 'None selected'}
                  </p>
                  <StatusPill tone={endpoint.enabled ? 'success' : 'neutral'}>
                    {endpoint.enabled ? 'Active' : 'Paused'}
                  </StatusPill>
                </div>
                {canEdit ? (
                  <div className={styles.itemActions}>
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
                        {endpoint.enabled ? 'Pause' : 'Activate'}
                      </Button>
                    </form>
                    <form action={deleteTenantWebhookEndpointFormAction}>
                      <input type="hidden" name="tenant_slug" value={tenantSlug} />
                      <input type="hidden" name="endpoint_id" value={endpoint.id} />
                      <Button type="submit" size="sm" variant="danger">
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
          <div className={styles.setupCard}>
            <p className={styles.setupTitle}>Add a webhook endpoint</p>
            <form action={webhookAction}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Your HTTPS URL</span>
                <span className={styles.fieldHint}>
                  Must be a secure (https://) address that can receive POST requests.
                </span>
                <input
                  className={styles.textInput}
                  name="url"
                  type="url"
                  placeholder="https://example.com/webhooks/clean-scheduler"
                  required
                  disabled={atLimit || webhookPending}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Label (optional)</span>
                <span className={styles.fieldHint}>
                  A friendly name so you remember what this endpoint is for.
                </span>
                <input
                  className={styles.textInput}
                  name="description"
                  placeholder="Zapier — new quotes"
                  disabled={atLimit || webhookPending}
                />
              </label>
              <fieldset className={styles.field}>
                <legend className={styles.fieldLabel}>Send notifications when…</legend>
                <div className={styles.eventGrid}>
                  {TENANT_WEBHOOK_EVENT_TYPES.map((eventType) => (
                    <label key={eventType} className={styles.eventToggle}>
                      <input
                        type="checkbox"
                        name="event_types"
                        value={eventType}
                        disabled={atLimit || webhookPending}
                      />
                      <span>{TENANT_WEBHOOK_EVENT_LABELS[eventType]}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Button type="submit" disabled={atLimit || webhookPending}>
                {webhookPending ? 'Adding…' : 'Add webhook'}
              </Button>
            </form>
          </div>
        ) : null}
      </section>
    </div>
  );
}
