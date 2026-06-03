import type { Database } from '@/lib/supabase/database.types';

export type TenantPromotionRow = Database['public']['Tables']['tenant_promotions']['Row'];
export type TenantPromotionType = Database['public']['Enums']['tenant_promotion_type'];
export type TenantPromotionUsageType = Database['public']['Enums']['tenant_promotion_usage_type'];
export type TenantPromotionRedemptionStatus =
  Database['public']['Enums']['tenant_promotion_redemption_status'];

export type PromotionListEntry = Pick<
  TenantPromotionRow,
  | 'id'
  | 'name'
  | 'code'
  | 'promotion_type'
  | 'promotion_value'
  | 'usage_type'
  | 'max_redemptions'
  | 'max_redemptions_per_customer'
  | 'min_purchase_cents'
  | 'valid_from'
  | 'valid_until'
  | 'is_active'
  | 'is_referral_only'
  | 'created_at'
> & {
  redemption_count: number;
};

export function promotionTypeLabel(type: TenantPromotionType): string {
  switch (type) {
    case 'percent':
      return 'Percent off';
    case 'fixed_cents':
      return 'Fixed amount off';
    case 'account_credit':
      return 'Account credit';
    default:
      return type;
  }
}

export function promotionUsageTypeLabel(type: TenantPromotionUsageType): string {
  switch (type) {
    case 'single_use':
      return 'One-time (single use)';
    case 'single_use_per_customer':
      return 'One-time per customer';
    case 'ongoing':
      return 'Ongoing (reusable)';
    case 'limited':
      return 'Limited total uses';
    default:
      return type;
  }
}

export function formatPromotionValue(type: TenantPromotionType, value: number): string {
  if (type === 'percent') {
    return `${(value / 100).toFixed(value % 100 === 0 ? 0 : 2)}%`;
  }
  return `$${(value / 100).toFixed(2)}`;
}
