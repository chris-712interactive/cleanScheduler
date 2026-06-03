'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import type { PromotionListEntry } from '@/lib/promotions/promotionTypes';
import {
  formatPromotionValue,
  promotionTypeLabel,
  promotionUsageTypeLabel,
} from '@/lib/promotions/promotionTypes';
import { promotionRowToFormDefaults } from '@/lib/promotions/promotionForm';
import {
  createTenantPromotionAction,
  toggleTenantPromotionActiveAction,
  updateTenantPromotionAction,
  type PromotionActionState,
} from './actions';
import styles from './promotions-settings.module.scss';

const initialState: PromotionActionState = {};

function PromotionFormFields({
  defaults,
  idPrefix,
}: {
  defaults?: Record<string, string>;
  idPrefix: string;
}) {
  const [promotionType, setPromotionType] = useState(defaults?.promotion_type ?? 'percent');
  const [usageType, setUsageType] = useState(defaults?.usage_type ?? 'single_use_per_customer');

  return (
    <div className={styles.formGrid}>
      <label className={styles.label} htmlFor={`${idPrefix}_name`}>
        Name
        <input
          id={`${idPrefix}_name`}
          name="name"
          className={styles.input}
          defaultValue={defaults?.name ?? ''}
          required
          placeholder="Spring 20% off"
        />
      </label>

      <label className={styles.label} htmlFor={`${idPrefix}_code`}>
        Code
        <input
          id={`${idPrefix}_code`}
          name="code"
          className={styles.input}
          defaultValue={defaults?.code ?? ''}
          required
          placeholder="SPRING20"
          autoComplete="off"
          spellCheck={false}
        />
        <span className={styles.hint}>Stored uppercase. Customers enter this on quotes.</span>
      </label>

      <label className={styles.label} htmlFor={`${idPrefix}_promotion_type`}>
        Reward type
        <select
          id={`${idPrefix}_promotion_type`}
          name="promotion_type"
          className={styles.select}
          value={promotionType}
          onChange={(e) => setPromotionType(e.target.value)}
        >
          <option value="percent">Percent off quote</option>
          <option value="fixed_cents">Fixed amount off quote</option>
          <option value="account_credit">Account credit (wallet)</option>
        </select>
      </label>

      <label className={styles.label} htmlFor={`${idPrefix}_usage_type`}>
        Usage
        <select
          id={`${idPrefix}_usage_type`}
          name="usage_type"
          className={styles.select}
          value={usageType}
          onChange={(e) => setUsageType(e.target.value)}
        >
          <option value="single_use_per_customer">One-time per customer</option>
          <option value="single_use">One-time (single use total)</option>
          <option value="ongoing">Ongoing (reusable)</option>
          <option value="limited">Limited total redemptions</option>
        </select>
      </label>

      {promotionType === 'percent' ? (
        <label className={styles.label} htmlFor={`${idPrefix}_percent_value`}>
          Percent off
          <input
            id={`${idPrefix}_percent_value`}
            name="percent_value"
            className={styles.input}
            inputMode="decimal"
            defaultValue={defaults?.percent_value ?? ''}
            placeholder="10"
          />
        </label>
      ) : (
        <label className={styles.label} htmlFor={`${idPrefix}_dollar_value`}>
          {promotionType === 'account_credit' ? 'Credit amount ($)' : 'Discount amount ($)'}
          <input
            id={`${idPrefix}_dollar_value`}
            name="dollar_value"
            className={styles.input}
            inputMode="decimal"
            defaultValue={defaults?.dollar_value ?? ''}
            placeholder="25.00"
          />
        </label>
      )}

      {usageType === 'limited' ? (
        <label className={styles.label} htmlFor={`${idPrefix}_max_redemptions`}>
          Max total redemptions
          <input
            id={`${idPrefix}_max_redemptions`}
            name="max_redemptions"
            className={styles.input}
            inputMode="numeric"
            defaultValue={defaults?.max_redemptions ?? ''}
            placeholder="100"
          />
        </label>
      ) : null}

      <label className={styles.label} htmlFor={`${idPrefix}_max_redemptions_per_customer`}>
        Max uses per customer
        <input
          id={`${idPrefix}_max_redemptions_per_customer`}
          name="max_redemptions_per_customer"
          className={styles.input}
          inputMode="numeric"
          defaultValue={defaults?.max_redemptions_per_customer ?? '1'}
        />
      </label>

      <label className={styles.label} htmlFor={`${idPrefix}_min_purchase_dollars`}>
        Minimum subtotal ($, optional)
        <input
          id={`${idPrefix}_min_purchase_dollars`}
          name="min_purchase_dollars"
          className={styles.input}
          inputMode="decimal"
          defaultValue={defaults?.min_purchase_dollars ?? ''}
          placeholder="Optional"
        />
      </label>

      <label className={styles.label} htmlFor={`${idPrefix}_valid_from`}>
        Valid from (optional)
        <input
          id={`${idPrefix}_valid_from`}
          name="valid_from"
          type="date"
          className={styles.input}
          defaultValue={defaults?.valid_from ?? ''}
        />
      </label>

      <label className={styles.label} htmlFor={`${idPrefix}_valid_until`}>
        Valid until (optional)
        <input
          id={`${idPrefix}_valid_until`}
          name="valid_until"
          type="date"
          className={styles.input}
          defaultValue={defaults?.valid_until ?? ''}
        />
      </label>

      <div className={`${styles.checkboxRow} ${styles.formGridFull}`}>
        <input
          id={`${idPrefix}_is_active`}
          name="is_active"
          type="checkbox"
          defaultChecked={defaults?.is_active !== 'false'}
          value="on"
        />
        <label htmlFor={`${idPrefix}_is_active`}>Active</label>
      </div>
    </div>
  );
}

function CreatePromotionForm({ tenantSlug, canEdit }: { tenantSlug: string; canEdit: boolean }) {
  const [state, formAction, pending] = useActionState(createTenantPromotionAction, initialState);

  if (!canEdit) return null;

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Create promotion</h2>
      <form action={formAction} className={styles.stack}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <PromotionFormFields idPrefix="create" />
        {state.error ? (
          <p className={styles.bannerError} role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className={styles.bannerSuccess} role="status">
            Promotion created.
          </p>
        ) : null}
        <div className={styles.inlineActions}>
          <Button type="submit" disabled={pending}>
            Create promotion
          </Button>
        </div>
      </form>
    </section>
  );
}

function PromotionRow({
  tenantSlug,
  entry,
  canEdit,
}: {
  tenantSlug: string;
  entry: PromotionListEntry;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateTenantPromotionAction, initialState);
  const defaults = promotionRowToFormDefaults(entry);

  return (
    <li className={styles.itemCard}>
      <div className={styles.itemHeader}>
        <h3 className={styles.itemTitle}>{entry.name}</h3>
        <span className={styles.codeBadge}>{entry.code}</span>
        <StatusPill tone={entry.is_active ? 'success' : 'neutral'}>
          {entry.is_active ? 'Active' : 'Inactive'}
        </StatusPill>
      </div>
      <p className={styles.itemMeta}>
        {promotionTypeLabel(entry.promotion_type)} ·{' '}
        {formatPromotionValue(entry.promotion_type, entry.promotion_value)} ·{' '}
        {promotionUsageTypeLabel(entry.usage_type)} · {entry.redemption_count} redemption
        {entry.redemption_count === 1 ? '' : 's'}
      </p>

      {canEdit ? (
        <>
          <form action={formAction} className={styles.stack}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <input type="hidden" name="promotion_id" value={entry.id} />
            <PromotionFormFields idPrefix={`edit_${entry.id}`} defaults={defaults} />
            {state.error ? (
              <p className={styles.bannerError} role="alert">
                {state.error}
              </p>
            ) : null}
            {state.success ? (
              <p className={styles.bannerSuccess} role="status">
                Saved.
              </p>
            ) : null}
            <div className={styles.inlineActions}>
              <Button type="submit" variant="secondary" size="sm" disabled={pending}>
                Save changes
              </Button>
            </div>
          </form>
          <form action={toggleTenantPromotionActiveAction} className={styles.inlineActions}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <input type="hidden" name="promotion_id" value={entry.id} />
            <input type="hidden" name="is_active" value={entry.is_active ? 'false' : 'true'} />
            <Button type="submit" variant="ghost" size="sm">
              {entry.is_active ? 'Deactivate' : 'Activate'}
            </Button>
          </form>
        </>
      ) : null}
    </li>
  );
}

export function PromotionsPanel({
  tenantSlug,
  canEdit,
  entries,
}: {
  tenantSlug: string;
  canEdit: boolean;
  entries: PromotionListEntry[];
}) {
  return (
    <div className={styles.stack}>
      <header className={styles.hero}>
        <h2 className={styles.heroTitle}>Discount codes & account credit</h2>
        <p className={styles.heroLead}>
          Create promo codes your team can apply on quotes. Percent and fixed discounts reduce the
          quote total; account credit codes add spendable balance to a customer wallet (redeem from
          the customer profile).
        </p>
      </header>

      <CreatePromotionForm tenantSlug={tenantSlug} canEdit={canEdit} />

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Your promotions</h2>
        {entries.length === 0 ? (
          <p className={styles.emptyState}>No promotions yet. Create your first code above.</p>
        ) : (
          <ul className={styles.itemList}>
            {entries.map((entry) => (
              <PromotionRow
                key={entry.id}
                tenantSlug={tenantSlug}
                entry={entry}
                canEdit={canEdit}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
