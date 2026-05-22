'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { customerPortalVerificationRecordName } from '@/lib/portal/customerPortalHostname';
import {
  buildDnsInstructionsFromVercel,
  buildFallbackDnsInstructions,
  buildLocalDevTxtInstruction,
} from '@/lib/portal/customerPortalDnsInstructions';
import type { VercelDomainVerificationRecord } from '@/lib/portal/vercelProjectDomains';
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
  vercelDomainTarget,
  localDevFallback,
  domain,
}: {
  tenantSlug: string;
  canEdit: boolean;
  sharedPortalHost: string;
  vercelAutomationConfigured: boolean;
  vercelDomainTarget: string | null;
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

    if (pendingDomain.vercelVerification.length > 0) {
      return buildDnsInstructionsFromVercel(
        pendingDomain.hostname,
        pendingDomain.vercelVerification,
      );
    }

    if (pendingDomain.verificationToken && localDevFallback && !vercelAutomationConfigured) {
      return [
        buildLocalDevTxtInstruction(
          pendingDomain.hostname,
          pendingDomain.verificationToken,
          customerPortalVerificationRecordName(pendingDomain.hostname),
        ),
      ];
    }

    return buildFallbackDnsInstructions(pendingDomain.hostname);
  }, [pendingDomain, localDevFallback, vercelAutomationConfigured]);

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
          Custom domain setup is temporarily unavailable. Please contact support.
        </p>
      ) : null}

      {!vercelAutomationConfigured && localDevFallback ? (
        <p className={styles.opsIntro} role="status">
          Local dev mode: set <code>VERCEL_API_TOKEN</code> and <code>VERCEL_PROJECT_ID</code> in
          `.env.local` for production-like DNS instructions from Vercel.
        </p>
      ) : null}

      {vercelAutomationConfigured && vercelDomainTarget ? (
        <p className={styles.opsIntro} role="status">
          Custom domains on this deployment attach to Vercel {vercelDomainTarget}. Production
          deployments leave both <code>VERCEL_DOMAIN_GIT_BRANCH</code> and{' '}
          <code>VERCEL_DOMAIN_CUSTOM_ENVIRONMENT_ID</code> unset.
        </p>
      ) : null}

      <p className={styles.opsIntro}>
        Serve your customer portal on your own domain so clients see your brand in invites and
        bookmarks. Business workspaces use <code>{sharedPortalHost}</code> by default.
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

      {canEdit && setupAvailable && !activeDomain && wizardStep === 1 ? (
        <section className={styles.integrationsSection}>
          <p className={styles.wizardStepLabel}>Step 1 of 2 — Choose your domain</p>
          <h3 className={styles.integrationsHeading}>Customer portal hostname</h3>
          <p className={styles.opsIntro}>
            Enter the full hostname your customers will use, such as{' '}
            <code>portal.yourcompany.com</code>. You must be able to edit DNS for this domain.
          </p>
          <form action={continueAction} className={styles.opsForm}>
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
              required
            />
            <Button type="submit" disabled={continuePending}>
              {continuePending ? 'Loading DNS instructions…' : 'Continue'}
            </Button>
          </form>
        </section>
      ) : null}

      {canEdit && setupAvailable && !activeDomain && wizardStep === 2 && pendingDomain ? (
        <section className={styles.integrationsSection}>
          <p className={styles.wizardStepLabel}>Step 2 of 2 — Configure DNS</p>
          <h3 className={styles.integrationsHeading}>Add DNS records for {pendingDomain.hostname}</h3>

          {pendingDomain.vercelLastError ? (
            <p className={styles.opsError} role="alert">
              {pendingDomain.vercelLastError}
            </p>
          ) : null}

          <CustomerPortalDnsInstructions
            portalHostname={pendingDomain.hostname}
            instructions={dnsInstructions}
          />

          {vercelAutomationConfigured && pendingDomain.vercelVerification.length === 0 ? (
            <form action={refreshAction} className={styles.dnsInstructionActions}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <Button type="submit" variant="secondary" disabled={refreshPending}>
                Refresh instructions
              </Button>
            </form>
          ) : null}

          <p className={styles.opsIntro}>
            After saving the records at your domain provider, click Verify DNS. We also re-check
            automatically every few minutes.
          </p>

          <div className={styles.dnsInstructionActions}>
            <form action={verifyAction}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <Button type="submit" disabled={verifyPending}>
                {verifyPending ? 'Verifying…' : 'Verify DNS'}
              </Button>
            </form>
            <form action={removeAction}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <Button type="submit" variant="secondary" disabled={removePending}>
                Use a different domain
              </Button>
            </form>
          </div>
        </section>
      ) : null}
    </div>
  );
}
