'use client';

import { useTransition } from 'react';
import { MoreVertical } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  canMarkManualPaymentBounced,
  canMarkManualPaymentCleared,
  canMarkManualPaymentDeposited,
  canMarkManualPaymentReceived,
  type ManualPaymentAuditStage,
} from '@/lib/billing/manualPaymentAudit';
import {
  markManualPaymentBounced,
  markManualPaymentCleared,
  markManualPaymentDeposited,
  markManualPaymentReceived,
} from './actions';
import styles from './paymentAudits.module.scss';

export function PaymentAuditRowActions({
  tenantSlug,
  paymentId,
  stage,
  method,
  invoiceHref,
}: {
  tenantSlug: string;
  paymentId: string;
  stage: ManualPaymentAuditStage;
  method: string;
  invoiceHref: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const markReceivedEnabled = canMarkManualPaymentReceived(stage);
  const markDepositedEnabled = canMarkManualPaymentDeposited(stage);
  const markClearedEnabled = canMarkManualPaymentCleared(stage);
  const markBouncedEnabled = canMarkManualPaymentBounced(stage);

  function markPayment(action: (formData: FormData) => Promise<void>) {
    const formData = new FormData();
    formData.set('tenant_slug', tenantSlug);
    formData.set('payment_id', paymentId);
    startTransition(() => {
      void action(formData);
    });
  }

  return (
    <div className={styles.actionsInner}>
      {invoiceHref ? (
        <a href={invoiceHref} className={styles.viewButton}>
          View
        </a>
      ) : (
        <span className={styles.viewButton} aria-disabled style={{ opacity: 0.5 }}>
          View
        </span>
      )}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" className={styles.menuTrigger} aria-label="Payment actions">
            <MoreVertical size={18} aria-hidden />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className={styles.menuPanel}
            sideOffset={4}
            align="end"
            collisionPadding={8}
          >
            <DropdownMenu.Item
              className={styles.menuButton}
              disabled={!markReceivedEnabled || pending}
              onSelect={() => markPayment(markManualPaymentReceived)}
            >
              Mark Received
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={styles.menuButton}
              disabled={!markDepositedEnabled || pending}
              onSelect={() => markPayment(markManualPaymentDeposited)}
            >
              Mark Deposited
            </DropdownMenu.Item>
            {method === 'check' ? (
              <>
                <DropdownMenu.Item
                  className={styles.menuButton}
                  disabled={!markClearedEnabled || pending}
                  onSelect={() => markPayment(markManualPaymentCleared)}
                >
                  Mark Cleared
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  className={styles.menuButton}
                  disabled={!markBouncedEnabled || pending}
                  onSelect={() => markPayment(markManualPaymentBounced)}
                >
                  Mark Bounced
                </DropdownMenu.Item>
              </>
            ) : null}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
