'use client';

import {
  Banknote,
  Building2,
  CreditCard,
  FileCheck,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { manualPaymentMethodLabel } from '@/lib/billing/manualPaymentAudit';
import styles from './paymentAudits.module.scss';

const METHOD_ICONS: Record<string, LucideIcon> = {
  cash: Banknote,
  check: FileCheck,
  zelle: Smartphone,
  ach: Building2,
  card: CreditCard,
  other: Wallet,
};

export function PaymentAuditMethodIcon({ method }: { method: string }) {
  const Icon = METHOD_ICONS[method] ?? Wallet;
  const label = manualPaymentMethodLabel(method);

  return (
    <span className={styles.methodIcon} title={label} aria-label={label} role="img">
      <Icon size={16} strokeWidth={2} aria-hidden />
    </span>
  );
}
