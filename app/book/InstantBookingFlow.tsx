'use client';

import { useActionState, useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { SmsOptInCheckboxLabel } from '@/components/legal/SmsOptInCheckboxLabel';
import { previewMatchesOffer } from '@/lib/booking/bookingGuards';
import {
  confirmInstantBookingAction,
  previewInstantBookingAction,
  type InstantConfirmState,
  type InstantPreviewState,
} from './instantActions';
import styles from './book.module.scss';

type Offer = {
  id: string;
  name: string;
  durationMinutes: number;
  pricingMethod: 'flat' | 'per_sqft' | 'beds_baths';
};

type Frequency = {
  value: string;
  label: string;
};

const previewInitial: InstantPreviewState = {};
const confirmInitial: InstantConfirmState = {};

const DETAIL_FIELDS = [
  'name',
  'email',
  'phone',
  'address_line1',
  'city',
  'state',
  'postal_code',
  'bedrooms',
  'bathrooms',
  'sqft',
] as const;

function PreviewButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" disabled={pending}>
      {pending ? 'Checking times…' : 'See times and price'}
    </Button>
  );
}

export function InstantBookingFlow({
  tenantSlug,
  offers,
  frequencies,
  collectCard,
  depositConfigured,
}: {
  tenantSlug: string;
  offers: Offer[];
  frequencies: Frequency[];
  collectCard: boolean;
  depositConfigured: boolean;
}) {
  const [offerId, setOfferId] = useState(offers[0]?.id ?? '');
  const [preview, previewAction] = useActionState(previewInstantBookingAction, previewInitial);
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmInstantBookingAction,
    confirmInitial,
  );
  const [details, setDetails] = useState<Record<string, string>>({});
  const [slotToken, setSlotToken] = useState('');
  const [frequency, setFrequency] = useState(frequencies[0]?.value ?? 'one_time');
  const [previewOfferId, setPreviewOfferId] = useState<string | null>(null);

  const offer = offers.find((item) => item.id === offerId) ?? offers[0];
  const slots = previewMatchesOffer(previewOfferId, offer?.id ?? '') ? (preview.slots ?? []) : [];
  const selected = slots.find((slot) => slot.token === slotToken);

  useEffect(() => {
    if (confirmState.checkoutUrl) window.location.assign(confirmState.checkoutUrl);
  }, [confirmState.checkoutUrl]);

  if (confirmState.checkoutUrl) {
    return <p className={styles.lead}>Sending you to secure checkout…</p>;
  }

  if (confirmState.success) {
    return (
      <div className={styles.form} role="status">
        <h2 className={styles.stepTitle}>You&apos;re booked</h2>
        <p>
          {confirmState.title} is on the calendar
          {confirmState.whenLabel ? ` for ${confirmState.whenLabel}` : ''}.
          {confirmState.priceLabel ? ` Price ${confirmState.priceLabel}.` : ''} A confirmation is on
          its way.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.stack}>
      <form
        action={previewAction}
        className={styles.form}
        onSubmit={(event) => {
          const data = new FormData(event.currentTarget);
          const next: Record<string, string> = {};
          for (const key of DETAIL_FIELDS) next[key] = String(data.get(key) ?? '');
          next.sms_opt_in = data.get('sms_opt_in') === 'on' ? 'on' : '';
          setDetails(next);
          setPreviewOfferId(offer?.id ?? null);
          setSlotToken('');
        }}
      >
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="offer_id" value={offer?.id ?? ''} />
        <div className={styles.honeypot} aria-hidden="true">
          <label>
            Company
            <input type="text" name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        <fieldset className={styles.choiceSet}>
          <legend className={styles.stepTitle}>Service</legend>
          {offers.map((item) => (
            <label key={item.id} className={styles.choice}>
              <input
                type="radio"
                name="offer_choice"
                value={item.id}
                checked={item.id === offer?.id}
                onChange={() => {
                  setOfferId(item.id);
                  setSlotToken('');
                }}
              />
              <span>
                {item.name}
                <span className={styles.choiceMeta}>
                  {item.durationMinutes} min
                  {item.pricingMethod === 'per_sqft' ? ' · priced by square feet' : ''}
                  {item.pricingMethod === 'beds_baths' ? ' · priced by beds and baths' : ''}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <label className={styles.field}>
          Your name
          <input name="name" required autoComplete="name" defaultValue={details.name ?? ''} />
        </label>
        <label className={styles.field}>
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={details.email ?? ''}
          />
        </label>
        <label className={styles.field}>
          Phone
          <input name="phone" type="tel" autoComplete="tel" defaultValue={details.phone ?? ''} />
        </label>
        <label className={styles.field}>
          Street address
          <input
            name="address_line1"
            required
            autoComplete="address-line1"
            defaultValue={details.address_line1 ?? ''}
          />
        </label>
        <div className={styles.row}>
          <label className={styles.field}>
            City
            <input
              name="city"
              required
              autoComplete="address-level2"
              defaultValue={details.city ?? ''}
            />
          </label>
          <label className={styles.field}>
            State
            <input
              name="state"
              required
              autoComplete="address-level1"
              maxLength={32}
              defaultValue={details.state ?? ''}
            />
          </label>
          <label className={styles.field}>
            ZIP
            <input
              name="postal_code"
              required
              autoComplete="postal-code"
              inputMode="numeric"
              defaultValue={details.postal_code ?? ''}
            />
          </label>
        </div>
        <div className={styles.row}>
          <label className={styles.field}>
            Bedrooms
            <input
              name="bedrooms"
              inputMode="numeric"
              required={offer?.pricingMethod === 'beds_baths'}
              defaultValue={details.bedrooms ?? ''}
            />
          </label>
          <label className={styles.field}>
            Bathrooms
            <input
              name="bathrooms"
              inputMode="decimal"
              required={offer?.pricingMethod === 'beds_baths'}
              defaultValue={details.bathrooms ?? ''}
            />
          </label>
          <label className={styles.field}>
            Square feet
            <input
              name="sqft"
              inputMode="numeric"
              required={offer?.pricingMethod === 'per_sqft'}
              defaultValue={details.sqft ?? ''}
            />
          </label>
        </div>

        <label className={styles.choice}>
          <input type="checkbox" name="sms_opt_in" value="on" />
          <SmsOptInCheckboxLabel />
        </label>
        <PreviewButton />
      </form>

      {slots.length > 0 && preview.priceLabel ? (
        <form action={confirmAction} className={styles.form}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="offer_id" value={offer?.id ?? ''} />
          {DETAIL_FIELDS.map((key) => (
            <input key={key} type="hidden" name={key} value={details[key] ?? ''} />
          ))}
          {details.sms_opt_in === 'on' ? (
            <input type="hidden" name="sms_opt_in" value="on" />
          ) : null}
          <h2 className={styles.stepTitle}>
            {preview.priceLabel}
            {preview.depositLabel ? ` · ${preview.depositLabel} due today` : ''}
          </h2>
          <fieldset className={styles.choiceSet}>
            <legend className={styles.stepTitle}>Time</legend>
            {slots.map((slot) => (
              <label key={slot.token} className={styles.choice}>
                <input
                  type="radio"
                  name="slot_token"
                  value={slot.token}
                  checked={slotToken === slot.token}
                  onChange={() => setSlotToken(slot.token)}
                  required
                />
                <span>{slot.label}</span>
              </label>
            ))}
          </fieldset>

          <label className={styles.field}>
            How often
            <select
              name="frequency"
              value={frequency}
              onChange={(event) => setFrequency(event.target.value)}
            >
              {frequencies.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          {confirmState.error ? <p className={styles.error}>{confirmState.error}</p> : null}
          <Button type="submit" variant="primary" disabled={confirmPending || !selected}>
            {confirmPending
              ? 'Booking…'
              : depositConfigured || collectCard
                ? 'Continue to payment'
                : 'Confirm visit'}
          </Button>
        </form>
      ) : null}

      {preview.slots &&
      previewMatchesOffer(previewOfferId, offer?.id ?? '') &&
      preview.slots.length === 0 &&
      !preview.error ? (
        <p className={styles.error}>
          No open times in the booking window. Contact the office and they can find another day.
        </p>
      ) : null}
    </div>
  );
}
