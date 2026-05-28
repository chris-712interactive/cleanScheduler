import {
  Banknote,
  Building2,
  CreditCard,
  FileCheck,
  Smartphone,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { transactionMethodDetail } from '@/lib/billing/transactionDisplay';
import styles from './transactions.module.scss';

const METHOD_ICONS: Record<string, LucideIcon> = {
  cash: Banknote,
  check: FileCheck,
  zelle: Smartphone,
  ach: Building2,
  card: CreditCard,
  other: Wallet,
};

function CardBrandMark({ brand }: { brand: 'visa' | 'mastercard' }) {
  if (brand === 'mastercard') {
    return (
      <span className={styles.cardBrand} data-brand="mastercard" aria-hidden>
        <span className={styles.mcCircle} data-variant="red" />
        <span className={styles.mcCircle} data-variant="orange" />
      </span>
    );
  }

  return (
    <span className={styles.cardBrand} data-brand="visa" aria-hidden>
      Visa
    </span>
  );
}

function cardBrandForRow(method: string, recordedVia: string, id: string): 'visa' | 'mastercard' {
  if (method !== 'card' && recordedVia !== 'stripe_checkout') {
    return 'visa';
  }
  // Stable visual variety when brand is unknown (no card metadata stored yet).
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return n % 2 === 0 ? 'visa' : 'mastercard';
}

export function TransactionMethodCell({
  method,
  recordedVia,
  notes,
  paymentId,
}: {
  method: string;
  recordedVia: string;
  notes: string | null;
  paymentId: string;
}) {
  const detail = transactionMethodDetail(method, recordedVia, notes);

  if (detail.isCard) {
    const brand = cardBrandForRow(method, recordedVia, paymentId);
    return (
      <span className={styles.methodCell}>
        <CardBrandMark brand={brand} />
        <span className={styles.methodText}>{detail.mask ?? detail.label}</span>
      </span>
    );
  }

  const Icon = METHOD_ICONS[method] ?? Wallet;

  return (
    <span className={styles.methodCell}>
      <span className={styles.methodIconWrap} aria-hidden>
        <Icon size={16} strokeWidth={2} />
      </span>
      <span className={styles.methodText}>{detail.label}</span>
    </span>
  );
}
