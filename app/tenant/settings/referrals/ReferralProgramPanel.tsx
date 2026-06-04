'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import type { PromotionListEntry } from '@/lib/promotions/promotionTypes';
import { formatPromotionValue, promotionTypeLabel } from '@/lib/promotions/promotionTypes';
import {
  REFERRAL_REWARD_SIDE_OPTIONS,
  referralRewardSideModeLabel,
} from '@/lib/referrals/referralTypes';
import type { ReferralProgramSnapshot } from '@/lib/referrals/loadTenantReferralProgram';
import { updateTenantReferralProgramAction, type ReferralProgramActionState } from './actions';
import styles from './referrals-settings.module.scss';

const initialState: ReferralProgramActionState = {};

function promotionOptionLabel(entry: PromotionListEntry): string {
  return `${entry.name} (${promotionTypeLabel(entry.promotion_type)} · ${formatPromotionValue(entry.promotion_type, entry.promotion_value)})`;
}

export function ReferralProgramPanel({
  tenantSlug,
  canEdit,
  program,
  promotions,
}: {
  tenantSlug: string;
  canEdit: boolean;
  program: ReferralProgramSnapshot;
  promotions: PromotionListEntry[];
}) {
  const [state, formAction, pending] = useActionState(
    updateTenantReferralProgramAction,
    initialState,
  );
  const [rewardSideMode, setRewardSideMode] = useState(program.reward_side_mode);

  const activePromotions = promotions.filter((p) => p.is_active);

  return (
    <div className={styles.stack}>
      <p className={styles.heroLead}>
        Choose who earns rewards when a referred customer qualifies, and link each side to a
        promotion template from <Link href="/settings/promotions">Promotions</Link>. Referrals
        qualify when the new customer pays their first invoice; rewards deposit to wallets
        automatically (fixed, account credit, or percent of the qualifying invoice). Review
        attributions in <Link href="/referrals">Referral activity</Link>.
      </p>

      {activePromotions.length === 0 ? (
        <p className={styles.hint}>
          Create at least one active promotion before enabling the referral program.
        </p>
      ) : null}

      <section className={styles.section}>
        <form action={formAction} className={styles.stack}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />

          <div className={`${styles.checkboxRow} ${styles.formGridFull}`}>
            <input
              id="referral_is_enabled"
              name="is_enabled"
              type="checkbox"
              defaultChecked={program.is_enabled}
              disabled={!canEdit}
              value="on"
            />
            <label htmlFor="referral_is_enabled">Enable customer referral program</label>
          </div>

          <div className={styles.formGrid}>
            <label className={styles.label} htmlFor="referral_reward_side_mode">
              Who gets rewarded
              <select
                id="referral_reward_side_mode"
                name="reward_side_mode"
                className={styles.select}
                value={rewardSideMode}
                disabled={!canEdit}
                onChange={(e) => setRewardSideMode(e.target.value as typeof rewardSideMode)}
              >
                {REFERRAL_REWARD_SIDE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className={styles.hint}>
                Current mode: {referralRewardSideModeLabel(rewardSideMode)}
              </span>
            </label>

            <label className={styles.label} htmlFor="referral_click_window_days">
              Attribution window (days)
              <input
                id="referral_click_window_days"
                name="click_window_days"
                className={styles.input}
                inputMode="numeric"
                defaultValue={String(program.click_window_days)}
                disabled={!canEdit}
              />
            </label>

            {rewardSideMode === 'referrer_only' || rewardSideMode === 'double_sided' ? (
              <label className={styles.label} htmlFor="referral_referrer_promotion_id">
                Referrer reward template
                <select
                  id="referral_referrer_promotion_id"
                  name="referrer_promotion_id"
                  className={styles.select}
                  defaultValue={program.referrer_promotion_id ?? ''}
                  disabled={!canEdit}
                >
                  <option value="">— Select —</option>
                  {activePromotions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {promotionOptionLabel(p)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="referrer_promotion_id" value="" />
            )}

            {rewardSideMode === 'double_sided' || rewardSideMode === 'referee_only' ? (
              <label className={styles.label} htmlFor="referral_referee_promotion_id">
                New customer reward template
                <select
                  id="referral_referee_promotion_id"
                  name="referee_promotion_id"
                  className={styles.select}
                  defaultValue={program.referee_promotion_id ?? ''}
                  disabled={!canEdit}
                >
                  <option value="">— Select —</option>
                  {activePromotions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {promotionOptionLabel(p)}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="referee_promotion_id" value="" />
            )}

            <label
              className={`${styles.label} ${styles.formGridFull}`}
              htmlFor="referral_share_headline"
            >
              Customer share headline (optional)
              <input
                id="referral_share_headline"
                name="share_headline"
                className={styles.input}
                defaultValue={program.share_headline ?? ''}
                disabled={!canEdit}
                placeholder="Refer a friend and earn $25 credit"
              />
            </label>

            <label
              className={`${styles.label} ${styles.formGridFull}`}
              htmlFor="referral_terms_text"
            >
              Terms shown to customers (optional)
              <textarea
                id="referral_terms_text"
                name="terms_text"
                className={styles.textarea}
                defaultValue={program.terms_text ?? ''}
                disabled={!canEdit}
                placeholder="Rewards apply after your friend's first completed paid visit."
              />
            </label>
          </div>

          {state.error ? (
            <p className={styles.bannerError} role="alert">
              {state.error}
            </p>
          ) : null}
          {state.success ? (
            <p className={styles.bannerSuccess} role="status">
              Referral program saved.
            </p>
          ) : null}

          {canEdit ? (
            <Button type="submit" disabled={pending || activePromotions.length === 0}>
              Save referral program
            </Button>
          ) : null}
        </form>
      </section>
    </div>
  );
}
