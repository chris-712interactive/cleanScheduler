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

function workflowValue(tier: PlatformPlanTier): string {
  return String(PLATFORM_TIER_ENTITLEMENTS[tier].limits.maxAutomationWorkflows);
}

function smsValue(tier: PlatformPlanTier): string {
  const credits = PLATFORM_TIER_ENTITLEMENTS[tier].limits.includedSmsCreditsMonthly;
  if (credits === 0) return '—';
  return credits.toLocaleString();
}

function campaignSendsValue(tier: PlatformPlanTier): string {
  const sends = PLATFORM_TIER_ENTITLEMENTS[tier].limits.maxCampaignSendsMonthly;
  if (sends === 0) return '—';
  return sends.toLocaleString();
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
    label: 'Recurring visit rules',
    values: {
      starter: workflowValue('starter'),
      business: workflowValue('business'),
      pro: workflowValue('pro'),
    },
  },
  {
    label: 'Customer portal',
    values: { starter: false, business: true, pro: true },
  },
  {
    label: 'White-label portal (custom domain)',
    values: { starter: false, business: false, pro: true },
  },
  {
    label: 'Marketing website CMS',
    values: { starter: false, business: true, pro: true },
  },
  {
    label: 'Unified custom domain (website + portal)',
    values: { starter: false, business: false, pro: true },
  },
  {
    label: 'Proof-of-service photos (crew upload)',
    values: { starter: false, business: true, pro: true },
  },
  {
    label: 'GPS-verified check-in',
    values: { starter: true, business: true, pro: true },
  },
  {
    label: 'Email visit & invoice reminders',
    values: { starter: true, business: true, pro: true },
  },
  {
    label: 'Public quote / booking request form',
    values: { starter: true, business: true, pro: true },
  },
  {
    label: 'Proof photos in customer portal',
    values: { starter: false, business: false, pro: true },
  },
  {
    label: 'Role permissions (admin/viewer)',
    values: { starter: false, business: true, pro: true },
  },
  {
    label: 'Email campaigns',
    values: {
      starter: false,
      business: campaignSendsValue('business') + '/mo',
      pro: campaignSendsValue('pro') + '/mo',
    },
  },
  {
    label: 'SMS customer communication',
    values: {
      starter: false,
      business: false,
      pro: smsValue('pro') + '/mo',
    },
  },
  {
    label: 'Payroll export',
    values: { starter: false, business: true, pro: true },
  },
  {
    label: 'Tips & commissions',
    values: { starter: false, business: true, pro: true },
  },
  {
    label: 'Sales tax summary',
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
    label: 'Forecasting (LTV / churn)',
    values: { starter: false, business: false, pro: true },
  },
  {
    label: 'API & webhooks',
    values: { starter: false, business: false, pro: true },
  },
];

function CellValue({ value }: { value: boolean | string }) {
  if (typeof value === 'string') {
    if (value === '—') {
      return (
        <span className={styles.cellValue}>
          <Minus size={18} aria-hidden className={styles.minusIcon} />
        </span>
      );
    }
    return (
      <span className={styles.cellValue}>
        <span className={styles.textValue}>{value}</span>
      </span>
    );
  }

  return (
    <span className={styles.cellValue}>
      {value ? (
        <Check size={18} aria-hidden className={styles.checkIcon} />
      ) : (
        <Minus size={18} aria-hidden className={styles.minusIcon} />
      )}
    </span>
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
