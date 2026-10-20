'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { PROPERTY_KIND_OPTIONS } from '@/lib/tenant/propertyKindLabels';
import { requestCustomerPropertyAction, type RequestPropertyState } from './actions';
import styles from './properties.module.scss';

const initial: RequestPropertyState = {};

export function RequestPropertyForm({
  links,
}: {
  links: { tenantId: string; customerId: string; tenantName: string }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(requestCustomerPropertyAction, initial);
  useFeedbackToast({ error: state.error, pending });
  const [selected, setSelected] = useState(links[0]?.customerId ?? '');
  const link = links.find((row) => row.customerId === selected) ?? links[0];
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [postal, setPostal] = useState('');
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState('residential');

  useEffect(() => {
    if (!state.savedAt) return;
    router.push('/properties?requested=1');
  }, [router, state.savedAt]);

  if (!link) return null;

  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="tenant_id" value={link.tenantId} />
      <input type="hidden" name="customer_id" value={link.customerId} />
      {links.length > 1 ? (
        <label className={styles.field}>
          Cleaning company
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            {links.map((row) => (
              <option key={row.customerId} value={row.customerId}>
                {row.tenantName}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className={styles.field}>
        Location name
        <input
          name="label"
          value={label}
          placeholder="Beach house, office, rental"
          onChange={(event) => setLabel(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        Type
        <select name="property_kind" value={kind} onChange={(event) => setKind(event.target.value)}>
          {PROPERTY_KIND_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Street
        <input
          name="address_line1"
          value={line1}
          autoComplete="address-line1"
          required
          onChange={(event) => setLine1(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        Apt, suite, or unit
        <input
          name="address_line2"
          value={line2}
          autoComplete="address-line2"
          onChange={(event) => setLine2(event.target.value)}
        />
      </label>
      <div className={styles.addressRow}>
        <label className={styles.field}>
          City
          <input
            name="city"
            value={city}
            autoComplete="address-level2"
            required
            onChange={(event) => setCity(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          State
          <input
            name="state"
            value={region}
            autoComplete="address-level1"
            required
            onChange={(event) => setRegion(event.target.value)}
          />
        </label>
        <label className={styles.field}>
          Postal code
          <input
            name="postal_code"
            value={postal}
            autoComplete="postal-code"
            onChange={(event) => setPostal(event.target.value)}
          />
        </label>
      </div>
      <label className={styles.field}>
        Note for your cleaner
        <textarea
          name="note"
          value={note}
          maxLength={500}
          rows={3}
          placeholder="Gate code, pets, or what you want cleaned"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className={styles.saveRow}>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Sending…' : 'Request this location'}
        </Button>
      </div>
    </form>
  );
}
