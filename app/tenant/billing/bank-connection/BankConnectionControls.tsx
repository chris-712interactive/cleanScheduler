'use client';

import { useState } from 'react';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/Button';
import { disconnectBankLinkAction, syncBankTransactionsAction } from './actions';
import { finishBankConnectionAction } from './finishBankConnectionAction';

interface BankConnectionControlsProps {
  tenantSlug: string;
  size?: ButtonSize;
}

export function SyncBankButton({ tenantSlug, size = 'sm' }: BankConnectionControlsProps) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      size={size}
      disabled={pending}
      onClick={() => {
        void (async () => {
          setPending(true);
          const formData = new FormData();
          formData.set('tenant_slug', tenantSlug);
          const result = await syncBankTransactionsAction(formData);
          finishBankConnectionAction(result, 'synced');
        })();
      }}
    >
      {pending ? 'Syncing…' : 'Sync now'}
    </Button>
  );
}

export function DisconnectBankButton({
  tenantSlug,
  size = 'sm',
  variant = 'ghost',
}: BankConnectionControlsProps & { variant?: ButtonVariant }) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={pending}
      onClick={() => {
        void (async () => {
          setPending(true);
          const formData = new FormData();
          formData.set('tenant_slug', tenantSlug);
          const result = await disconnectBankLinkAction(formData);
          finishBankConnectionAction(result, 'disconnected');
        })();
      }}
    >
      {pending ? 'Disconnecting…' : 'Disconnect'}
    </Button>
  );
}
