import { Check, Minus } from 'lucide-react';
import { PLATFORM_TIER_ENTITLEMENTS } from '@/lib/billing/entitlements';
import { MARKETING_PLAN_ORDER } from '@/lib/billing/marketingPlanCatalog';
import type { PlatformPlanTier } from '@/lib/billing/platformPlanTier';
import { formatFieldSeatLimit } from '@/lib/billing/teamSeats';
import styles from './PricingComparisonMatrix.module.scss';

type ComparisonRow = {
  label: string;
  values: Record<PlatformPlanTier, boolean | string>;
};

function officeSeatValue(tier: PlatformPlanTier): string {
  return String(PLATFORM_TIER_ENTITLEMENTS[tier].limits.includedOfficeSeats);
}

function fieldSeatValue(tier: PlatformPlanTier): string {
  return formatFieldSeatLimit(PLATFORM_TIER_ENTITLEMENTS[tier].limits.includedFieldSeats);
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: 'Office seats (owner, admin, viewer)',
    values: {
      starter: officeSeatValue('starter'),
      business: officeSeatValue('business'),
      pro: officeSeatValue('pro'),
    },
  },
  {
    label: 'Field seats (employees)',
    values: {
      starter: fieldSeatValue('starter'),
      business: fieldSeatValue('business'),
      pro: fieldSeatValue('pro'),
    },
  },
  {
    label: 'Active customers',
    values: {
      starter: '500',
      business: '5,000',
      pro: '25,000',
    },
  },
  {
    label: 'Customer portal',
    values: { starter: false, business: true, pro: true },
  },
  {
    label: 'Email campaigns',
    values: { starter: false, business: true, pro: true },
  },
  {
    label: 'Payroll export',
    values: { starter: false, business: true, pro: true },
  },
  {
    label: 'Bank reconciliation',
    values: { starter: false, business: true, pro: true },
  },
  {
    label: 'Advanced analytics',
    values: { starter: false, business: false, pro: true },
  },
  {
    label: 'API & webhooks',
    values: { starter: false, business: false, pro: true },
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    return <span className={styles.textValue}>{value}</span>;
  }

  return value ? (
    <Check size={18} aria-hidden className={styles.checkIcon} />
  ) : (
    <Minus size={18} aria-hidden className={styles.minusIcon} />
  );
}

export function PricingComparisonMatrix() {
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            {MARKETING_PLAN_ORDER.map((tier) => (
              <th key={tier} scope="col">
                {PLATFORM_TIER_ENTITLEMENTS[tier].displayName}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              {MARKETING_PLAN_ORDER.map((tier) => (
                <td key={tier}>
                  <CellValue value={row.values[tier]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
