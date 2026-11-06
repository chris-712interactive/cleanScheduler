'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import {
  deactivateInstantBookingOffer,
  saveInstantBookingOffer,
  type BookingRequestSettingsState,
} from './actions';
import styles from './booking-settings.module.scss';

const initial: BookingRequestSettingsState = {};

type Zone = { id: string; name: string };
type Option = { id: string; name: string };

export type OfferDraft = {
  id?: string;
  name: string;
  durationMinutes: number;
  pricingMethod: 'flat' | 'per_sqft' | 'beds_baths';
  baseDollars: string;
  perSqftDollars: string;
  perBedroomDollars: string;
  perBathroomDollars: string;
  servicePlanId: string;
  serviceTemplateId: string;
  zoneIds: string[];
  isActive: boolean;
};

function OfferForm({
  tenantSlug,
  offer,
  zones,
  plans,
  templates,
  readOnly,
}: {
  tenantSlug: string;
  offer: OfferDraft;
  zones: Zone[];
  plans: Option[];
  templates: Option[];
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(saveInstantBookingOffer, initial);
  const [retireState, retireAction, retirePending] = useActionState(
    deactivateInstantBookingOffer,
    initial,
  );
  useFeedbackToast({
    error: state.error ?? retireState.error,
    success: state.success || retireState.success,
    pending: pending || retirePending,
  });

  return (
    <div className={styles.offerCard}>
      <form action={action} className={styles.grid}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        {offer.id ? <input type="hidden" name="offer_id" value={offer.id} /> : null}
        <label className={styles.field}>
          Name
          <input name="name" required defaultValue={offer.name} disabled={readOnly || pending} />
        </label>
        <label className={styles.field}>
          Duration (minutes)
          <input
            name="duration_minutes"
            type="number"
            min={15}
            max={720}
            defaultValue={offer.durationMinutes}
            disabled={readOnly || pending}
          />
        </label>
        <label className={styles.field}>
          Pricing
          <select
            name="pricing_method"
            defaultValue={offer.pricingMethod}
            disabled={readOnly || pending}
          >
            <option value="flat">Flat rate</option>
            <option value="per_sqft">Base plus per square foot</option>
            <option value="beds_baths">Base plus beds and baths</option>
          </select>
        </label>
        <label className={styles.field}>
          Base price (dollars)
          <input
            name="base_dollars"
            defaultValue={offer.baseDollars}
            disabled={readOnly || pending}
          />
        </label>
        <label className={styles.field}>
          Per sq ft (dollars)
          <input
            name="per_sqft_dollars"
            defaultValue={offer.perSqftDollars}
            disabled={readOnly || pending}
          />
        </label>
        <label className={styles.field}>
          Per bedroom (dollars)
          <input
            name="per_bedroom_dollars"
            defaultValue={offer.perBedroomDollars}
            disabled={readOnly || pending}
          />
        </label>
        <label className={styles.field}>
          Per bathroom (dollars)
          <input
            name="per_bathroom_dollars"
            defaultValue={offer.perBathroomDollars}
            disabled={readOnly || pending}
          />
        </label>
        <label className={styles.field}>
          Service plan
          <select
            name="service_plan_id"
            defaultValue={offer.servicePlanId}
            disabled={readOnly || pending}
          >
            <option value="">None</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Service template
          <select
            name="service_template_id"
            defaultValue={offer.serviceTemplateId}
            disabled={readOnly || pending}
          >
            <option value="">None</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </label>
        {zones.length > 0 ? (
          <fieldset className={styles.zones}>
            <legend>Limit to zones</legend>
            {zones.map((zone) => (
              <label key={zone.id}>
                <input
                  type="checkbox"
                  name="zone_ids"
                  value={zone.id}
                  defaultChecked={offer.zoneIds.includes(zone.id)}
                  disabled={readOnly || pending}
                />{' '}
                {zone.name}
              </label>
            ))}
          </fieldset>
        ) : null}
        <label>
          <input
            type="checkbox"
            name="is_active"
            defaultChecked={offer.isActive}
            disabled={readOnly || pending}
          />{' '}
          Bookable
        </label>
        {!readOnly ? (
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : offer.id ? 'Update service' : 'Add service'}
          </Button>
        ) : null}
      </form>
      {offer.id && offer.isActive && !readOnly ? (
        <form action={retireAction}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="offer_id" value={offer.id} />
          <Button type="submit" variant="secondary" disabled={retirePending}>
            Stop offering
          </Button>
        </form>
      ) : null}
    </div>
  );
}

export function InstantBookingOffers({
  tenantSlug,
  offers,
  zones,
  plans,
  templates,
  readOnly,
}: {
  tenantSlug: string;
  offers: OfferDraft[];
  zones: Zone[];
  plans: Option[];
  templates: Option[];
  readOnly: boolean;
}) {
  const blank: OfferDraft = {
    name: '',
    durationMinutes: 120,
    pricingMethod: 'flat',
    baseDollars: '',
    perSqftDollars: '0.00',
    perBedroomDollars: '0.00',
    perBathroomDollars: '0.00',
    servicePlanId: '',
    serviceTemplateId: '',
    zoneIds: [],
    isActive: true,
  };

  return (
    <div className={styles.offerList}>
      {offers.map((offer) => (
        <OfferForm
          key={offer.id}
          tenantSlug={tenantSlug}
          offer={offer}
          zones={zones}
          plans={plans}
          templates={templates}
          readOnly={readOnly}
        />
      ))}
      {!readOnly ? (
        <OfferForm
          tenantSlug={tenantSlug}
          offer={blank}
          zones={zones}
          plans={plans}
          templates={templates}
          readOnly={false}
        />
      ) : null}
    </div>
  );
}
