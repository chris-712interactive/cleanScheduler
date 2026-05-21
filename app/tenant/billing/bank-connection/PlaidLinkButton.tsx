'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Button } from '@/components/ui/Button';
import { connectBankFromPlaidAction, fetchPlaidLinkTokenAction } from './actions';
import { finishBankConnectionAction } from './finishBankConnectionAction';

interface PlaidLinkButtonProps {
  tenantSlug: string;
  label: string;
  variant?: 'primary' | 'secondary';
}

export function PlaidLinkButton({
  tenantSlug,
  label,
  variant = 'primary',
}: PlaidLinkButtonProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchLinkToken = useCallback(async () => {
    setLoadingToken(true);
    setError(null);
    try {
      const result = await fetchPlaidLinkTokenAction(tenantSlug);
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
  }, [tenantSlug]);

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

  return (
    <div>
      <Button
        type="button"
        variant={variant}
        disabled={loadingToken || submitting}
        onClick={() => {
          void fetchLinkToken();
        }}
      >
        {loadingToken || submitting ? 'Opening Plaid…' : label}
      </Button>
      {error ? (
        <p style={{ color: 'var(--color-danger)', marginTop: 'var(--space-2)' }} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
