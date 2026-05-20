'use client';

import { MoreVertical } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  canMarkManualPaymentDeposited,
  canMarkManualPaymentReceived,
  type ManualPaymentAuditStage,
} from '@/lib/billing/manualPaymentAudit';
import { markManualPaymentDeposited, markManualPaymentReceived } from './actions';
import styles from './paymentAudits.module.scss';

export function PaymentAuditRowActions({
  tenantSlug,
  paymentId,
  stage,
  invoiceHref,
}: {
  tenantSlug: string;
  paymentId: string;
  stage: ManualPaymentAuditStage;
  invoiceHref: string | null;
}) {
  const markReceivedEnabled = canMarkManualPaymentReceived(stage);
  const markDepositedEnabled = canMarkManualPaymentDeposited(stage);

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
          <button
            type="button"
            className={styles.menuTrigger}
            aria-label="Payment actions"
          >
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
            <form action={markManualPaymentReceived} className={styles.menuItem}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <input type="hidden" name="payment_id" value={paymentId} />
              <DropdownMenu.Item
                asChild
                disabled={!markReceivedEnabled}
                onSelect={(event) => {
                  if (!markReceivedEnabled) event.preventDefault();
                }}
              >
                <button
                  type="submit"
                  className={styles.menuButton}
                  disabled={!markReceivedEnabled}
                  aria-disabled={!markReceivedEnabled}
                  tabIndex={markReceivedEnabled ? 0 : -1}
                >
                  Mark Received
                </button>
              </DropdownMenu.Item>
            </form>
            <form action={markManualPaymentDeposited} className={styles.menuItem}>
              <input type="hidden" name="tenant_slug" value={tenantSlug} />
              <input type="hidden" name="payment_id" value={paymentId} />
              <DropdownMenu.Item
                asChild
                disabled={!markDepositedEnabled}
                onSelect={(event) => {
                  if (!markDepositedEnabled) event.preventDefault();
                }}
              >
                <button
                  type="submit"
                  className={styles.menuButton}
                  disabled={!markDepositedEnabled}
                  aria-disabled={!markDepositedEnabled}
                  tabIndex={markDepositedEnabled ? 0 : -1}
                >
                  Mark Deposited
                </button>
              </DropdownMenu.Item>
            </form>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}
