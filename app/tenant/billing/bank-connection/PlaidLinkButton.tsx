'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/Button';
import { PLAID_CONSENT_REQUIRED_ERROR } from '@/lib/plaid/plaidConsentCopy';
import { connectBankFromPlaidAction, fetchPlaidLinkTokenAction } from './actions';
import { finishBankConnectionAction } from './finishBankConnectionAction';
import { PlaidPreLinkConsent } from './PlaidPreLinkConsent';
import styles from './bank-connection.module.scss';

interface PlaidLinkButtonProps {
  tenantSlug: string;
  label: string;
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  /** Show consent checkbox only after the user clicks the initial button. */
  consentFlow?: 'inline' | 'step';
}

export function PlaidLinkButton({
  tenantSlug,
  label,
  variant = 'primary',
  size = 'md',
  consentFlow = 'inline',
}: PlaidLinkButtonProps) {
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentStepOpen, setConsentStepOpen] = useState(consentFlow === 'inline');
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchLinkToken = useCallback(async () => {
    if (!consentChecked) {
      setError(PLAID_CONSENT_REQUIRED_ERROR);
      return;
    }

    setLoadingToken(true);
    setError(null);
    try {
      const result = await fetchPlaidLinkTokenAction(tenantSlug, { consentAcknowledged: true });
      if ('error' in result) {
        throw new Error(result.error);
      }
      setLinkToken(result.link_token);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start Plaid Link.');
      setLinkToken(null);
    } finally {
      setLoadingToken(false);
    }
  }, [consentChecked, tenantSlug]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (publicToken, metadata) => {
      const account = metadata.accounts[0];
      if (!account) {
        setError('Plaid did not return a bank account.');
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.set('tenant_slug', tenantSlug);
        formData.set('public_token', publicToken);
        formData.set('account_json', JSON.stringify(account));
        formData.set('plaid_consent', '1');
        if (metadata.institution) {
          formData.set('institution_json', JSON.stringify(metadata.institution));
        }
        const result = await connectBankFromPlaidAction(formData);
        finishBankConnectionAction(result, 'connected');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save bank connection.');
        setSubmitting(false);
      }
    },
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  const showConsent = consentFlow === 'inline' || consentStepOpen;
  const primaryDisabled =
    consentFlow === 'step' && !consentStepOpen
      ? loadingToken || submitting
      : !consentChecked || loadingToken || submitting;

  return (
    <div>
      {showConsent ? (
        <PlaidPreLinkConsent consentChecked={consentChecked} onConsentChange={setConsentChecked} />
      ) : null}
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={primaryDisabled}
        onClick={() => {
          if (consentFlow === 'step' && !consentStepOpen) {
            setConsentStepOpen(true);
            setError(null);
            return;
          }
          void fetchLinkToken();
        }}
        style={showConsent ? { marginTop: 'var(--space-4)' } : undefined}
      >
        {loadingToken || submitting
          ? 'Opening Plaid…'
          : consentFlow === 'step' && !consentStepOpen
            ? label
            : consentFlow === 'step'
              ? 'Continue to Plaid'
              : label}
      </Button>
      {error ? (
        <p
          className={styles.muted}
          style={{ color: 'var(--color-danger)', marginTop: 'var(--space-2)' }}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
