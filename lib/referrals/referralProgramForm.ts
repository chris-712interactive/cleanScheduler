import type { ReferralRewardSideMode } from '@/lib/referrals/referralTypes';

export type ParsedReferralProgramForm =
  | {
      ok: true;
      is_enabled: boolean;
      reward_side_mode: ReferralRewardSideMode;
      referrer_promotion_id: string | null;
      referee_promotion_id: string | null;
      click_window_days: number;
      share_headline: string | null;
      terms_text: string | null;
    }
  | { ok: false; error: string };

const SIDE_MODES = new Set<ReferralRewardSideMode>([
  'referrer_only',
  'double_sided',
  'referee_only',
]);

function parseOptionalUuid(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed;
}

export function parseReferralProgramForm(formData: FormData): ParsedReferralProgramForm {
  const is_enabled = formData.get('is_enabled') === 'on' || formData.get('is_enabled') === 'true';
  const rewardSideRaw = String(formData.get('reward_side_mode') ?? '').trim();

  if (!SIDE_MODES.has(rewardSideRaw as ReferralRewardSideMode)) {
    return { ok: false, error: 'Select who receives referral rewards.' };
  }
  const reward_side_mode = rewardSideRaw as ReferralRewardSideMode;

  const referrer_promotion_id = parseOptionalUuid(
    String(formData.get('referrer_promotion_id') ?? ''),
  );
  const referee_promotion_id = parseOptionalUuid(
    String(formData.get('referee_promotion_id') ?? ''),
  );

  if (reward_side_mode === 'referrer_only' || reward_side_mode === 'double_sided') {
    if (!referrer_promotion_id) {
      return { ok: false, error: 'Select a promotion template for the referring customer.' };
    }
  }

  if (reward_side_mode === 'double_sided' || reward_side_mode === 'referee_only') {
    if (!referee_promotion_id) {
      return { ok: false, error: 'Select a promotion template for the new customer.' };
    }
  }

  const windowRaw = String(formData.get('click_window_days') ?? '30').trim();
  const click_window_days = Number(windowRaw);
  if (!Number.isFinite(click_window_days) || click_window_days < 1 || click_window_days > 365) {
    return { ok: false, error: 'Attribution window must be between 1 and 365 days.' };
  }

  const share_headline = String(formData.get('share_headline') ?? '').trim() || null;
  const terms_text = String(formData.get('terms_text') ?? '').trim() || null;

  return {
    ok: true,
    is_enabled,
    reward_side_mode,
    referrer_promotion_id,
    referee_promotion_id,
    click_window_days: Math.round(click_window_days),
    share_headline,
    terms_text,
  };
}

export function buildReferralShareCopy(input: {
  rewardSideMode: ReferralRewardSideMode;
  referrerPromotionLabel: string | null;
  refereePromotionLabel: string | null;
  shareHeadline: string | null;
}): string {
  if (input.shareHeadline?.trim()) return input.shareHeadline.trim();

  if (input.rewardSideMode === 'double_sided') {
    return `Give ${input.refereePromotionLabel ?? 'friends a reward'}, get ${input.referrerPromotionLabel ?? 'credit'} when they book.`;
  }
  if (input.rewardSideMode === 'referee_only') {
    return `Share ${input.refereePromotionLabel ?? 'a welcome offer'} with friends.`;
  }
  return `Refer friends and earn ${input.referrerPromotionLabel ?? 'account credit'} when they become a customer.`;
}
