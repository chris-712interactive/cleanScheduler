'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { CustomerPropertyGroup } from '@/app/tenant/quotes/QuoteCreateForm';
import { createRecurringVisitRuleAction } from './actions';
import { TimezoneOffsetField } from './TimezoneOffsetField';
import { OFFICE_SET_PRICE_HINT } from '@/lib/billing/resolveVisitExpectedAmount';
import styles from '../schedule.module.scss';

export function RecurringRuleForm({
  tenantSlug,
  customers,
  customerPropertyGroups,
  quoteOptions,
}: {
  tenantSlug: string;
  customers: { id: string; label: string }[];
  customerPropertyGroups: CustomerPropertyGroup[];
  quoteOptions: { id: string; label: string }[];
}) {
  const [customerId, setCustomerId] = useState('');

  const propertyOptions = useMemo(() => {
    return customerPropertyGroups.find((group) => group.customerId === customerId)?.options ?? [];
  }, [customerPropertyGroups, customerId]);

  return (
    <form action={createRecurringVisitRuleAction} className={styles.form}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <TimezoneOffsetField />
      <label className={styles.label}>
        Customer
        <select
          name="customer_id"
          className={styles.select}
          required
          value={customerId}
          onChange={(event) => setCustomerId(event.target.value)}
        >
          <option value="" disabled>
            Select customer…
          </option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.label}
            </option>
          ))}
        </select>
      </label>
      {customerId ? (
        <label className={styles.label}>
          Service location (optional)
          <select name="property_id" className={styles.select} defaultValue="">
            <option value="">Primary or first address on file</option>
            {propertyOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="property_id" value="" />
      )}
      <label className={styles.label}>
        Pattern
        <select name="preset" className={styles.select} required defaultValue="weekly_mon">
          <option value="weekly_mon">Weekly · Monday</option>
          <option value="weekly_tue">Weekly · Tuesday</option>
          <option value="weekly_wed">Weekly · Wednesday</option>
          <option value="weekly_thu">Weekly · Thursday</option>
          <option value="weekly_fri">Weekly · Friday</option>
          <option value="biweekly_mon">Every other week · Monday</option>
          <option value="monthly_1">Monthly · 1st</option>
          <option value="monthly_15">Monthly · 15th</option>
        </select>
      </label>
      <label className={styles.label}>
        Title
        <input name="title" className={styles.input} type="text" placeholder="Bi-weekly clean" />
      </label>
      <div className={styles.formGridTwo}>
        <label className={styles.label}>
          Related quote (optional)
          <select name="quote_id" className={styles.select} defaultValue="">
            <option value="">— None —</option>
            {quoteOptions.map((quote) => (
              <option key={quote.id} value={quote.id}>
                {quote.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.label}>
          Job price per visit (USD)
          <input
            name="job_price_dollars"
            className={styles.input}
            type="number"
            min="0"
            step="0.01"
            placeholder="150.00"
          />
        </label>
      </div>
      <p className={styles.crewHint}>{OFFICE_SET_PRICE_HINT}</p>
      <label className={styles.label}>
        First occurrence (local)
        <input name="starts_at" className={styles.input} type="datetime-local" required />
      </label>
      <label className={styles.label}>
        Visit length (minutes)
        <input
          name="visit_duration_minutes"
          className={styles.input}
          type="number"
          min={30}
          max={1440}
          defaultValue={120}
        />
      </label>
      <label className={styles.label}>
        Horizon (days)
        <input
          name="horizon_days"
          className={styles.input}
          type="number"
          min={1}
          max={120}
          defaultValue={60}
        />
      </label>
      <Button type="submit" variant="primary">
        Save rule
      </Button>
    </form>
  );
}
