'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { customerPortalVerificationRecordName } from '@/lib/portal/customerPortalHostname';
import { customerPortalDomainStoredError } from '@/lib/portal/customerPortalDomainCopy';
import {
  buildCustomerPortalDnsInstructions,
  buildLocalDevTxtInstruction,
} from '@/lib/portal/customerPortalDnsInstructions';
import type {
  VercelDomainDnsConfig,
  VercelDomainVerificationRecord,
} from '@/lib/portal/vercelProjectDomains';
import { CustomerPortalDnsInstructions } from './CustomerPortalDnsInstructions';
import {
  continueCustomerPortalDomainAction,
  refreshCustomerPortalDomainDnsAction,
  removeCustomerPortalDomainAction,
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
  vercelDnsConfig,
  localDevFallback,
  domain,
}: {
  tenantSlug: string;
  canEdit: boolean;
  sharedPortalHost: string;
  vercelAutomationConfigured: boolean;
  vercelDnsConfig: VercelDomainDnsConfig | null;
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
  const [continueState, continueAction, continuePending] = useActionState(
    continueCustomerPortalDomainAction,
    initialState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyCustomerPortalDomainAction,
    initialState,
  );
  const [refreshState, refreshAction, refreshPending] = useActionState(
    refreshCustomerPortalDomainDnsAction,
    initialState,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeCustomerPortalDomainAction,
    initialState,
  );
  const [banner, setBanner] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  useEffect(() => {
    const error =
      continueState.error ?? verifyState.error ?? refreshState.error ?? removeState.error;
    const success =
      continueState.success ?? verifyState.success ?? refreshState.success ?? removeState.success;
    if (error) setBanner({ kind: 'error', text: error });
    else if (success) setBanner({ kind: 'success', text: success });
    else setBanner(null);
  }, [continueState, verifyState, refreshState, removeState]);

  const activeDomain = domain?.status === 'active' ? domain : null;
  const pendingDomain = domain?.status === 'pending' ? domain : null;
  const wizardStep: 1 | 2 = pendingDomain ? 2 : 1;

  const dnsInstructions = useMemo(() => {
    if (!pendingDomain) return [];

    if (vercelAutomationConfigured) {
      return buildCustomerPortalDnsInstructions({
        portalHostname: pendingDomain.hostname,
        vercelVerification: pendingDomain.vercelVerification,
        vercelDnsConfig,
      });
    }

    if (pendingDomain.verificationToken && localDevFallback) {
      return [
        buildLocalDevTxtInstruction(
          pendingDomain.hostname,
          pendingDomain.verificationToken,
          customerPortalVerificationRecordName(pendingDomain.hostname),
        ),
      ];
    }

    return buildCustomerPortalDnsInstructions({
      portalHostname: pendingDomain.hostname,
      vercelVerification: pendingDomain.vercelVerification,
    });
  }, [pendingDomain, localDevFallback, vercelAutomationConfigured, vercelDnsConfig]);

  const setupAvailable = vercelAutomationConfigured || localDevFallback;

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

      {!setupAvailable ? (
        <p className={styles.opsIntro} role="status">
          Custom domain setup is not available right now. Please contact support for help.
        </p>
      ) : null}

      <p className={styles.opsIntro}>
        Use your own web address for the customer portal so clients see your brand in invite links
        and bookmarks. Without a custom domain, clients use{' '}
        <code>{sharedPortalHost}</code>.
      </p>

      {activeDomain ? (
        <section className={styles.integrationsSection}>
          <h3 className={styles.integrationsHeading}>Your portal address</h3>
          <p className={styles.opsIntro}>
            Customers can sign in at <code>https://{activeDomain.hostname}</code>
            {activeDomain.verifiedAt ? (
              <>
                {' '}
                (connected{' '}
                {new Date(activeDomain.verifiedAt).toLocaleDateString(undefined, {
                  dateStyle: 'medium',
                })}
                )
              </>
            ) : null}
          </p>
          {activeDomain.authRedirectLastError ? (
            <p className={styles.opsError} role="alert">
              Sign-in is still being set up for this address. If customers cannot log in after a
              day, contact support.
            </p>
          ) : null}
          {canEdit ? (
            <form action={removeAction}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <Button type="submit" variant="secondary" disabled={removePending}>
                Remove custom address
              </Button>
            </form>
          ) : null}
        </section>
      ) : null}

      {canEdit && setupAvailable && !activeDomain && wizardStep === 1 ? (
        <section className={styles.integrationsSection}>
          <p className={styles.wizardStepLabel}>Step 1 of 2 — Enter your address</p>
          <h3 className={styles.integrationsHeading}>Portal web address</h3>
          <p className={styles.opsIntro}>
            Enter the full address your customers will use, such as{' '}
            <code>portal.yourcompany.com</code>. You will need access to your domain settings to
            add a few DNS records in the next step.
          </p>
          <form action={continueAction} className={styles.opsForm}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <label className={styles.fieldLabel} htmlFor="customer_portal_hostname">
              Web address
            </label>
            <input
              id="customer_portal_hostname"
              name="hostname"
              type="text"
              className={styles.input}
              placeholder="portal.yourcompany.com"
              required
            />
            <Button type="submit" disabled={continuePending}>
              {continuePending ? 'Preparing instructions…' : 'Continue'}
            </Button>
          </form>
        </section>
      ) : null}

      {canEdit && setupAvailable && !activeDomain && wizardStep === 2 && pendingDomain ? (
        <section className={styles.integrationsSection}>
          <p className={styles.wizardStepLabel}>Step 2 of 2 — Add DNS records</p>
          <h3 className={styles.integrationsHeading}>DNS settings for {pendingDomain.hostname}</h3>

          {pendingDomain.vercelLastError ? (
            <p className={styles.opsError} role="alert">
              {customerPortalDomainStoredError(pendingDomain.vercelLastError)}
            </p>
          ) : null}

          <CustomerPortalDnsInstructions
            portalHostname={pendingDomain.hostname}
            instructions={dnsInstructions}
          />

          {vercelAutomationConfigured && pendingDomain.vercelVerification.length === 0 && !vercelDnsConfig?.recommendedCname ? (
            <form action={refreshAction} className={styles.dnsInstructionActions}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <Button type="submit" variant="secondary" disabled={refreshPending}>
                Refresh records
              </Button>
            </form>
          ) : null}

          <p className={styles.opsIntro}>
            After you save the records, click Check connection below. We will also check
            automatically every few minutes.
          </p>

          <div className={styles.dnsInstructionActions}>
            <form action={verifyAction}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <Button type="submit" disabled={verifyPending}>
                {verifyPending ? 'Checking…' : 'Check connection'}
              </Button>
            </form>
            <form action={removeAction}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <Button type="submit" variant="secondary" disabled={removePending}>
                Start over
              </Button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
}
