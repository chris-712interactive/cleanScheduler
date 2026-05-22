'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { customerPortalVerificationRecordName } from '@/lib/portal/customerPortalHostname';
import type { VercelDomainVerificationRecord } from '@/lib/portal/vercelProjectDomains';
import {
  removeCustomerPortalDomainAction,
  saveCustomerPortalDomainAction,
  verifyCustomerPortalDomainAction,
  type CustomerPortalDomainActionState,
} from './actions';
import styles from '../settings.module.scss';

const initialState: CustomerPortalDomainActionState = {};

export function CustomerPortalDomainPanel({
  tenantSlug,
  canEdit,
  sharedPortalHost,
  vercelAutomationConfigured,
  localDevFallback,
  domain,
}: {
  tenantSlug: string;
  canEdit: boolean;
  sharedPortalHost: string;
  vercelAutomationConfigured: boolean;
  localDevFallback: boolean;
  domain: {
    hostname: string;
    status: 'pending' | 'active';
    verificationToken: string | null;
    verifiedAt: string | null;
    vercelVerification: VercelDomainVerificationRecord[];
    vercelLastError: string | null;
    authRedirectLastError: string | null;
  } | null;
}) {
  const [saveState, saveAction, savePending] = useActionState(
    saveCustomerPortalDomainAction,
    initialState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyCustomerPortalDomainAction,
    initialState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeCustomerPortalDomainAction,
    initialState,
  );
  const [banner, setBanner] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    const error = saveState.error ?? verifyState.error ?? removeState.error;
    const success = saveState.success ?? verifyState.success ?? removeState.success;
    if (error) setBanner({ kind: 'error', text: error });
    else if (success) setBanner({ kind: 'success', text: success });
    else setBanner(null);
  }, [saveState, verifyState, removeState]);

  const activeDomain = domain?.status === 'active' ? domain : null;
  const pendingDomain = domain?.status === 'pending' ? domain : null;
  const vercelRecords = pendingDomain?.vercelVerification ?? [];
  const localTxtRecord =
    pendingDomain?.verificationToken && localDevFallback && !vercelAutomationConfigured
      ? customerPortalVerificationRecordName(pendingDomain.hostname)
      : null;

  return (
    <div className={styles.integrationsStack}>
      {banner ? (
        <p
          className={banner.kind === 'error' ? styles.opsError : styles.opsSuccess}
          role={banner.kind === 'error' ? 'alert' : 'status'}
        >
          {banner.text}
        </p>
      ) : null}

      {!vercelAutomationConfigured && !localDevFallback ? (
        <p className={styles.opsIntro} role="status">
          Custom domain setup is temporarily unavailable. Please contact support.
        </p>
      ) : null}

      {!vercelAutomationConfigured && localDevFallback ? (
        <p className={styles.opsIntro} role="status">
          Local dev mode: set <code>VERCEL_API_TOKEN</code> and <code>VERCEL_PROJECT_ID</code> in
          `.env.local` to exercise the production Vercel registration flow.
        </p>
      ) : null}

      <p className={styles.opsIntro}>
        Point your own domain at the customer portal so clients see your brand and URL in invites
        and bookmarks. Business workspaces use <code>{sharedPortalHost}</code> by default; Pro can
        replace that with a custom hostname after DNS verification.
      </p>

      {activeDomain ? (
        <section className={styles.integrationsSection}>
          <h3 className={styles.integrationsHeading}>Active domain</h3>
          <p className={styles.opsIntro}>
            Customer portal URL: <code>https://{activeDomain.hostname}</code>
            {activeDomain.verifiedAt ? (
              <>
                {' '}
                (verified{' '}
                {new Date(activeDomain.verifiedAt).toLocaleDateString(undefined, {
                  dateStyle: 'medium',
                })}
                )
              </>
            ) : null}
          </p>
          {activeDomain.authRedirectLastError ? (
            <p className={styles.opsError} role="alert">
              Google sign-in callback pending: {activeDomain.authRedirectLastError}
            </p>
          ) : null}
          {canEdit ? (
            <form action={removeAction}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <Button type="submit" variant="secondary" disabled={removePending}>
                Remove custom domain
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}

      {canEdit && (vercelAutomationConfigured || localDevFallback) ? (
        <section className={styles.integrationsSection}>
          <h3 className={styles.integrationsHeading}>
            {pendingDomain ? 'Update pending domain' : 'Custom domain'}
          </h3>
          <form action={saveAction} className={styles.opsForm}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <label className={styles.fieldLabel} htmlFor="customer_portal_hostname">
              Hostname
            </label>
            <input
              id="customer_portal_hostname"
              name="hostname"
              type="text"
              className={styles.input}
              placeholder="portal.yourcompany.com"
              defaultValue={pendingDomain?.hostname ?? ''}
              required
            />
            <Button type="submit" disabled={savePending}>
              {pendingDomain ? 'Update domain' : 'Save domain'}
            </Button>
          </form>
        </section>
      ) : null}

      {pendingDomain && (vercelRecords.length > 0 || localTxtRecord) ? (
        <section className={styles.integrationsSection}>
          <h3 className={styles.integrationsHeading}>DNS records</h3>
          {pendingDomain.vercelLastError ? (
            <p className={styles.opsError} role="alert">
              {pendingDomain.vercelLastError}
            </p>
          ) : null}
          <ol className={styles.opsIntro}>
            {vercelRecords.map((record) => (
              <li key={`${record.type}-${record.domain}-${record.value}`}>
                Add a <strong>{record.type}</strong> record:
                <br />
                Host / name: <code>{record.domain}</code>
                <br />
                Value: <code>{record.value}</code>
                {record.reason ? (
                  <>
                    <br />
                    <span>{record.reason}</span>
                  </>
                ) : null}
              </li>
            ))}
            {localTxtRecord && pendingDomain.verificationToken ? (
              <li>
                Add a <strong>TXT</strong> record (local dev fallback):
                <br />
                Host / name: <code>{localTxtRecord}</code>
                <br />
                Value: <code>{pendingDomain.verificationToken}</code>
              </li>
            ) : null}
          </ol>
          <p className={styles.opsIntro}>
            DNS changes can take up to an hour to propagate. We re-check automatically every few
            minutes once records are saved — you can also click Verify DNS for an immediate check.
          </p>
          {canEdit ? (
            <form action={verifyAction}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <Button type="submit" disabled={verifyPending}>
                Verify DNS
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
