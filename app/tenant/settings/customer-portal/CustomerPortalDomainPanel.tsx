'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { customerPortalVerificationRecordName } from '@/lib/portal/customerPortalHostname';
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
  cnameTarget,
  domain,
}: {
  tenantSlug: string;
  canEdit: boolean;
  cnameTarget: string;
  domain: {
    hostname: string;
    status: 'pending' | 'active';
    verificationToken: string;
    verifiedAt: string | null;
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
  const txtRecord = pendingDomain
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

      <p className={styles.opsIntro}>
        Point your own domain at the customer portal so clients see your brand and URL in invites
        and bookmarks. Business workspaces use <code>my.{cnameTarget.replace(/^my\./, '')}</code>{' '}
        by default; Pro can replace that with a custom hostname after DNS verification.
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

      {canEdit ? (
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

      {pendingDomain && txtRecord ? (
        <section className={styles.integrationsSection}>
          <h3 className={styles.integrationsHeading}>DNS records</h3>
          <ol className={styles.opsIntro}>
            <li>
              Add a <strong>TXT</strong> record:
              <br />
              Host / name: <code>{txtRecord}</code>
              <br />
              Value: <code>{pendingDomain.verificationToken}</code>
            </li>
            <li>
              Add a <strong>CNAME</strong> record:
              <br />
              Host / name: <code>{pendingDomain.hostname}</code>
              <br />
              Target: <code>{cnameTarget}</code>
            </li>
            <li>
              Add <code>{pendingDomain.hostname}</code> to your Vercel project under Settings →
              Domains (required for HTTPS).
            </li>
          </ol>
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
