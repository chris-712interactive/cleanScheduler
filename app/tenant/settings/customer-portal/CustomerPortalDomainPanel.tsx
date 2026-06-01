'use client';

import Link from 'next/link';
import { Globe, Palette } from 'lucide-react';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import type { StatusTone } from '@/components/ui/StatusPill';
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
import styles from './customer-portal-settings.module.scss';

const initialState: CustomerPortalDomainActionState = {};

type SetupPhase = 'not_started' | 'pending_dns' | 'live';

function setupPhase(domain: CustomerPortalDomainPanelProps['domain']): SetupPhase {
  if (domain?.status === 'active') return 'live';
  if (domain?.status === 'pending') return 'pending_dns';
  return 'not_started';
}

function statusMeta(phase: SetupPhase): {
  tone: StatusTone;
  pillLabel: string;
  title: string;
  lead: string;
} {
  switch (phase) {
    case 'live':
      return {
        tone: 'success',
        pillLabel: 'Live',
        title: 'Your custom portal address is connected',
        lead: 'Customer invite links, quote emails, and invoice pay links now use your web address instead of the shared portal.',
      };
    case 'pending_dns':
      return {
        tone: 'warning',
        pillLabel: 'Waiting for DNS',
        title: 'Almost there — add the DNS records below',
        lead: 'We saved your address. Add the records at your domain provider, then check the connection here. We also recheck automatically every few minutes.',
      };
    default:
      return {
        tone: 'neutral',
        pillLabel: 'Not set up',
        title: 'Use your own web address for the customer portal',
        lead: 'Give customers a branded link like portal.yourcompany.com. You will add a couple of DNS records at your domain provider — no coding required.',
      };
  }
}

type StepperState = 'upcoming' | 'current' | 'done';

function stepperState(step: 1 | 2 | 3, phase: SetupPhase): StepperState {
  if (phase === 'live') return 'done';
  if (phase === 'pending_dns') {
    if (step === 1) return 'done';
    if (step === 2) return 'current';
    return 'upcoming';
  }
  if (step === 1) return 'current';
  return 'upcoming';
}

export interface CustomerPortalDomainPanelProps {
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
}

export function CustomerPortalDomainPanel({
  tenantSlug,
  canEdit,
  sharedPortalHost,
  vercelAutomationConfigured,
  vercelDnsConfig,
  localDevFallback,
  domain,
}: CustomerPortalDomainPanelProps) {
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

  const phase = setupPhase(domain);
  const meta = statusMeta(phase);
  const pendingDomain = domain?.status === 'pending' ? domain : null;
  const activeDomain = domain?.status === 'active' ? domain : null;
  const setupAvailable = vercelAutomationConfigured || localDevFallback;

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

  const showDnsRefresh =
    vercelAutomationConfigured &&
    pendingDomain &&
    pendingDomain.vercelVerification.length === 0 &&
    !vercelDnsConfig?.recommendedCname;

  return (
    <div className={styles.portalStack}>
      {banner ? (
        <p
          className={banner.kind === 'error' ? styles.bannerError : styles.bannerSuccess}
          role={banner.kind === 'error' ? 'alert' : 'status'}
        >
          {banner.text}
        </p>
      ) : null}

      {!setupAvailable ? (
        <p className={styles.bannerError} role="status">
          Custom domain setup is not available right now. Please contact support for help.
        </p>
      ) : null}

      <section className={styles.portalHero} aria-labelledby="portal-setup-heading">
        <div className={styles.portalHeroTop}>
          <div className={styles.portalHeroIconWrap} aria-hidden>
            <Globe size={28} strokeWidth={1.75} />
          </div>
          <div className={styles.portalHeroCopy}>
            <div className={styles.portalHeroHeadingRow}>
              <p className={styles.portalHeroEyebrow}>Custom portal address</p>
              <StatusPill tone={meta.tone}>{meta.pillLabel}</StatusPill>
            </div>
            <h2 id="portal-setup-heading" className={styles.portalHeroTitle}>
              {meta.title}
            </h2>
            <p className={styles.portalHeroLead}>{meta.lead}</p>
          </div>
        </div>

        {phase !== 'live' ? (
          <ol className={styles.stepper} aria-label="Setup progress">
            {(
              [
                {
                  step: 1 as const,
                  title: 'Choose your address',
                  hint: 'Pick the link customers will use',
                },
                { step: 2 as const, title: 'Add DNS records', hint: 'At your domain provider' },
                { step: 3 as const, title: 'Go live', hint: 'We verify and activate' },
              ] as const
            ).map(({ step, title, hint }) => (
              <li key={step} className={styles.stepperItem} data-state={stepperState(step, phase)}>
                <span className={styles.stepperBadge} aria-hidden>
                  {stepperState(step, phase) === 'done' ? '✓' : step}
                </span>
                <p className={styles.stepperTitle}>{title}</p>
                <p className={styles.stepperHint}>{hint}</p>
              </li>
            ))}
          </ol>
        ) : null}

        {activeDomain ? (
          <div className={styles.liveUrlCard}>
            <p className={styles.liveUrlLabel}>Customer portal URL</p>
            <a
              className={styles.liveUrlLink}
              href={`https://${activeDomain.hostname}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              https://{activeDomain.hostname}
            </a>
            {activeDomain.verifiedAt ? (
              <p className={styles.portalHeroMeta}>
                Connected{' '}
                {new Date(activeDomain.verifiedAt).toLocaleDateString(undefined, {
                  dateStyle: 'medium',
                })}
              </p>
            ) : null}
          </div>
        ) : null}

        {activeDomain?.authRedirectLastError ? (
          <p className={styles.bannerError} role="alert">
            Sign-in is still being configured for this address. If customers cannot log in after a
            day, contact support.
          </p>
        ) : null}

        {activeDomain && canEdit ? (
          <div className={styles.portalHeroActions}>
            <form action={removeAction}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <Button type="submit" variant="secondary" disabled={removePending}>
                Remove custom address
              </Button>
            </form>
          </div>
        ) : null}
      </section>

      {phase === 'not_started' ? (
        <section className={styles.compareCard} aria-label="Portal address options">
          <article className={styles.compareOption}>
            <h3 className={styles.compareOptionTitle}>Without custom address (default)</h3>
            <p className={styles.compareOptionBody}>
              Customers use the shared Clean Scheduler portal. Works on all paid plans.
            </p>
            <p className={styles.compareOptionHost}>{sharedPortalHost}</p>
          </article>
          <article className={styles.compareOption}>
            <h3 className={styles.compareOptionTitle}>With custom address (Pro)</h3>
            <p className={styles.compareOptionBody}>
              Customers see your domain in links and bookmarks. Requires DNS setup at your domain
              registrar.
            </p>
            <p className={styles.compareOptionHost}>portal.yourcompany.com</p>
          </article>
        </section>
      ) : null}

      {canEdit && setupAvailable && phase === 'not_started' ? (
        <section className={styles.setupSection} aria-labelledby="choose-address-heading">
          <header className={styles.setupSectionHeader}>
            <p className={styles.setupSectionEyebrow}>Step 1 of 3</p>
            <h3 id="choose-address-heading" className={styles.setupSectionTitle}>
              Enter your portal web address
            </h3>
            <p className={styles.setupSectionLead}>
              Use a subdomain you control — most cleaning businesses choose something like{' '}
              <strong>portal</strong>, <strong>clients</strong>, or <strong>book</strong>. You will
              need login access to your domain&apos;s DNS settings in the next step.
            </p>
          </header>

          <form action={continueAction} className={styles.hostnameForm}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <label className={styles.fieldLabel} htmlFor="customer_portal_hostname">
              Full web address
            </label>
            <input
              id="customer_portal_hostname"
              name="hostname"
              type="text"
              className={styles.input}
              placeholder="portal.yourcompany.com"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <p className={styles.fieldHint}>
              Enter the complete address customers will type or click — not just the subdomain word.
            </p>
            <ul className={styles.exampleList} aria-label="Example addresses">
              {['portal.sparkleclean.com', 'clients.yourbrand.com', 'book.mycleaning.co'].map(
                (example) => (
                  <li key={example} className={styles.exampleChip}>
                    {example}
                  </li>
                ),
              )}
            </ul>
            <Button type="submit" disabled={continuePending}>
              {continuePending ? 'Preparing DNS instructions…' : 'Continue to DNS setup'}
            </Button>
          </form>
        </section>
      ) : null}

      {setupAvailable && phase === 'pending_dns' && pendingDomain ? (
        <section className={styles.setupSection} aria-labelledby="dns-setup-heading">
          <header className={styles.setupSectionHeader}>
            <p className={styles.setupSectionEyebrow}>Step 2 of 3</p>
            <h3 id="dns-setup-heading" className={styles.setupSectionTitle}>
              Add DNS records for {pendingDomain.hostname}
            </h3>
            <p className={styles.setupSectionLead}>
              DNS records tell the internet where to send visitors who open your custom address. You
              only need to add them once.
            </p>
          </header>

          {pendingDomain.vercelLastError ? (
            <p className={styles.bannerError} role="alert">
              {customerPortalDomainStoredError(pendingDomain.vercelLastError)}
            </p>
          ) : null}

          <CustomerPortalDnsInstructions
            portalHostname={pendingDomain.hostname}
            instructions={dnsInstructions}
          />

          {canEdit ? (
            <div className={styles.dnsActions}>
              <form action={verifyAction}>
                <input type="hidden" name="tenant_slug" value={tenantSlug} />
                <Button type="submit" disabled={verifyPending}>
                  {verifyPending ? 'Checking connection…' : 'Check connection'}
                </Button>
              </form>
              {showDnsRefresh ? (
                <form action={refreshAction}>
                  <input type="hidden" name="tenant_slug" value={tenantSlug} />
                  <Button type="submit" variant="secondary" disabled={refreshPending}>
                    Refresh records
                  </Button>
                </form>
              ) : null}
              <form action={removeAction}>
                <input type="hidden" name="tenant_slug" value={tenantSlug} />
                <Button type="submit" variant="secondary" disabled={removePending}>
                  Start over
                </Button>
              </form>
            </div>
          ) : (
            <p className={styles.fieldHint} role="status">
              An owner or admin needs to finish DNS setup and check the connection.
            </p>
          )}
        </section>
      ) : null}

      {phase === 'live' ? (
        <section className={styles.brandingLinkCard} aria-labelledby="branding-reminder-heading">
          <h3 id="branding-reminder-heading" className={styles.brandingLinkTitle}>
            <Palette
              size={18}
              strokeWidth={2}
              aria-hidden
              style={{ verticalAlign: 'text-bottom' }}
            />{' '}
            Finish your customer-facing branding
          </h3>
          <p className={styles.brandingLinkLead}>
            Your custom address is live. Add your logo and business name in Business settings so
            customers see your brand when they sign in.
          </p>
          <Link className={styles.brandingLink} href="/settings/business">
            Open business branding settings →
          </Link>
        </section>
      ) : (
        <section className={styles.brandingLinkCard} aria-labelledby="branding-preview-heading">
          <h3 id="branding-preview-heading" className={styles.brandingLinkTitle}>
            Logo and business name
          </h3>
          <p className={styles.brandingLinkLead}>
            Custom DNS controls your web address. Your logo and company name are configured
            separately and appear in the portal header and emails.
          </p>
          <Link className={styles.brandingLink} href="/settings/business">
            Set up branding in Business settings →
          </Link>
        </section>
      )}

      <section className={styles.goodToKnow} aria-labelledby="portal-good-to-know">
        <h3 id="portal-good-to-know" className={styles.goodToKnowTitle}>
          Good to know
        </h3>
        <ul className={styles.goodToKnowList}>
          <li>
            You must manage DNS where your domain is registered (or where its nameservers point).
            Clean Scheduler cannot add records for you.
          </li>
          <li>
            DNS changes usually propagate within a few minutes but can take up to an hour. If
            verification fails, wait and click Check connection again.
          </li>
          <li>
            Use a subdomain like <strong>portal.yourcompany.com</strong> — not your main marketing
            website unless you intend for the portal to live there.
          </li>
          <li>
            Until your custom address is live, customers continue using{' '}
            <strong>{sharedPortalHost}</strong>.
          </li>
          {phase === 'pending_dns' ? (
            <li>
              We automatically recheck your DNS every few minutes. You do not need to keep this page
              open.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
