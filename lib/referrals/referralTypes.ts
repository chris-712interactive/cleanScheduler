import type { Database } from '@/lib/supabase/database.types';

export type TenantReferralProgramRow =
  Database['public']['Tables']['tenant_referral_programs']['Row'];
export type ReferralRewardSideMode =
  Database['public']['Enums']['tenant_referral_reward_side_mode'];
export type ReferralAttributionStatus = Database['public']['Enums']['referral_attribution_status'];
export type ReferralRewardRecipient = Database['public']['Enums']['referral_reward_recipient'];

export function referralRewardSideModeLabel(mode: ReferralRewardSideMode): string {
  switch (mode) {
    case 'referrer_only':
      return 'Referrer only';
    case 'double_sided':
      return 'Referrer and new customer';
    case 'referee_only':
      return 'New customer only';
    default:
      return mode;
  }
}

export const REFERRAL_REWARD_SIDE_OPTIONS: { value: ReferralRewardSideMode; label: string }[] = [
  { value: 'referrer_only', label: 'Referrer only' },
  { value: 'double_sided', label: 'Both referrer and new customer' },
  { value: 'referee_only', label: 'New customer only' },
];

export const REFERRAL_COOKIE_NAME = 'cs_referral_code';
