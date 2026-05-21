'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { disconnectBankLinkAction, syncBankTransactionsAction } from './actions';
import { finishBankConnectionAction } from './finishBankConnectionAction';

interface BankConnectionControlsProps {
  tenantSlug: string;
}

export function SyncBankButton({ tenantSlug }: BankConnectionControlsProps) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
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

export function DisconnectBankButton({ tenantSlug }: BankConnectionControlsProps) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
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
