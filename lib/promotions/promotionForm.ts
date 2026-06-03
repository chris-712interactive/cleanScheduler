import { normalizePromoCode } from '@/lib/promotions/normalizePromoCode';
import type {
  TenantPromotionType,
  TenantPromotionUsageType,
} from '@/lib/promotions/promotionTypes';

export type ParsedPromotionForm =
  | {
      ok: true;
      name: string;
      code: string;
      promotion_type: TenantPromotionType;
      promotion_value: number;
      usage_type: TenantPromotionUsageType;
      max_redemptions: number | null;
      max_redemptions_per_customer: number;
      min_purchase_cents: number | null;
      valid_from: string | null;
      valid_until: string | null;
      is_active: boolean;
    }
  | { ok: false; error: string };

const PROMOTION_TYPES = new Set<TenantPromotionType>(['percent', 'fixed_cents', 'account_credit']);
const USAGE_TYPES = new Set<TenantPromotionUsageType>([
  'single_use',
  'single_use_per_customer',
  'ongoing',
  'limited',
]);

function parseOptionalDollarsToCents(
  raw: string,
): { ok: true; cents: number | null } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, cents: null };
  const n = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: 'Amount must be a non-negative number.' };
  }
  return { ok: true, cents: Math.round(n * 100) };
}

function parsePercentToBps(raw: string): { ok: true; bps: number } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: 'Percent value is required.' };
  const n = Number(trimmed.replace(/,/g, ''));
  if (!Number.isFinite(n) || n <= 0 || n > 100) {
    return { ok: false, error: 'Percent must be between 0 and 100.' };
  }
  return { ok: true, bps: Math.round(n * 100) };
}

function parseOptionalDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const d = new Date(`${trimmed}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function parsePromotionForm(formData: FormData): ParsedPromotionForm {
  const name = String(formData.get('name') ?? '').trim();
  const code = normalizePromoCode(String(formData.get('code') ?? ''));
  const promotionTypeRaw = String(formData.get('promotion_type') ?? '').trim();
  const usageTypeRaw = String(formData.get('usage_type') ?? '').trim();
  const isActive = formData.get('is_active') === 'on' || formData.get('is_active') === 'true';

  if (!name) return { ok: false, error: 'Name is required.' };
  if (code.length < 2) return { ok: false, error: 'Code must be at least 2 characters.' };

  if (!PROMOTION_TYPES.has(promotionTypeRaw as TenantPromotionType)) {
    return { ok: false, error: 'Select a valid promotion type.' };
  }
  const promotion_type = promotionTypeRaw as TenantPromotionType;

  if (!USAGE_TYPES.has(usageTypeRaw as TenantPromotionUsageType)) {
    return { ok: false, error: 'Select a valid usage type.' };
  }
  const usage_type = usageTypeRaw as TenantPromotionUsageType;

  let promotion_value = 0;
  if (promotion_type === 'percent') {
    const p = parsePercentToBps(String(formData.get('percent_value') ?? ''));
    if (!p.ok) return p;
    promotion_value = p.bps;
  } else {
    const d = parseOptionalDollarsToCents(String(formData.get('dollar_value') ?? ''));
    if (!d.ok) return d;
    if (d.cents == null || d.cents <= 0) {
      return { ok: false, error: 'Dollar amount is required.' };
    }
    promotion_value = d.cents;
  }

  let max_redemptions: number | null = null;
  if (usage_type === 'limited') {
    const raw = String(formData.get('max_redemptions') ?? '').trim();
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false, error: 'Limited promotions require a max redemption count.' };
    }
    max_redemptions = Math.round(n);
  }

  const perCustomerRaw = String(formData.get('max_redemptions_per_customer') ?? '1').trim();
  const perCustomer = Number(perCustomerRaw);
  if (!Number.isFinite(perCustomer) || perCustomer <= 0) {
    return { ok: false, error: 'Max uses per customer must be at least 1.' };
  }

  const minPurchase = parseOptionalDollarsToCents(
    String(formData.get('min_purchase_dollars') ?? ''),
  );
  if (!minPurchase.ok) return minPurchase;

  return {
    ok: true,
    name,
    code,
    promotion_type,
    promotion_value,
    usage_type,
    max_redemptions,
    max_redemptions_per_customer: Math.round(perCustomer),
    min_purchase_cents: minPurchase.cents,
    valid_from: parseOptionalDate(String(formData.get('valid_from') ?? '')),
    valid_until: parseOptionalDate(String(formData.get('valid_until') ?? '')),
    is_active: isActive,
  };
}

export function promotionRowToFormDefaults(row: {
  name: string;
  code: string;
  promotion_type: TenantPromotionType;
  promotion_value: number;
  usage_type: TenantPromotionUsageType;
  max_redemptions: number | null;
  max_redemptions_per_customer: number;
  min_purchase_cents: number | null;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
}): Record<string, string> {
  const validFrom = row.valid_from ? row.valid_from.slice(0, 10) : '';
  const validUntil = row.valid_until ? row.valid_until.slice(0, 10) : '';
  return {
    name: row.name,
    code: row.code,
    promotion_type: row.promotion_type,
    usage_type: row.usage_type,
    percent_value: row.promotion_type === 'percent' ? String(row.promotion_value / 100) : '',
    dollar_value: row.promotion_type !== 'percent' ? (row.promotion_value / 100).toFixed(2) : '',
    max_redemptions: row.max_redemptions != null ? String(row.max_redemptions) : '',
    max_redemptions_per_customer: String(row.max_redemptions_per_customer),
    min_purchase_dollars:
      row.min_purchase_cents != null ? (row.min_purchase_cents / 100).toFixed(2) : '',
    valid_from: validFrom,
    valid_until: validUntil,
    is_active: row.is_active ? 'true' : 'false',
  };
}
