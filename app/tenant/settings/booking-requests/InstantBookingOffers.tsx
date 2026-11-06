'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { PROPERTY_KIND_OPTIONS, type CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import {
  deactivateInstantBookingOffer,
  saveInstantBookingOffer,
  type BookingRequestSettingsState,
} from './actions';
import styles from './booking-settings.module.scss';

const initial: BookingRequestSettingsState = {};

type Zone = { id: string; name: string };
type Option = { id: string; name: string };
type TemplateOption = { id: string; name: string; jobType: CustomerPropertyKind | null };

function groupedTemplates(templates: TemplateOption[]) {
  const groups = PROPERTY_KIND_OPTIONS.map((kind) => ({
    label: kind.label,
    options: templates.filter((template) => template.jobType === kind.value),
  })).filter((group) => group.options.length > 0);
  const untyped = templates.filter((template) => template.jobType == null);
  if (untyped.length > 0) {
    groups.push({ label: 'Not tied to a property type', options: untyped });
  }
  return groups;
}
type PricingMethod = 'flat' | 'per_sqft' | 'beds_baths';

export type OfferDraft = {
  id?: string;
  name: string;
  durationMinutes: number;
  pricingMethod: PricingMethod;
  baseDollars: string;
  perSqftDollars: string;
  perBedroomDollars: string;
  perBathroomDollars: string;
  servicePlanId: string;
  serviceTemplateId: string;
  zoneIds: string[];
  isActive: boolean;
};

function priceSummary(offer: OfferDraft): string {
  const base = offer.baseDollars ? `$${offer.baseDollars}` : 'No base price';
  if (offer.pricingMethod === 'per_sqft') return `${base} plus per sq ft`;
  if (offer.pricingMethod === 'beds_baths') return `${base} plus beds and baths`;
  return `${base} flat`;
}

function OfferForm({
  tenantSlug,
  offer,
  zones,
  plans,
  templates,
  readOnly,
  allowPerSqft,
  allowBedsBaths,
  draft = false,
}: {
  tenantSlug: string;
  offer: OfferDraft;
  zones: Zone[];
  plans: Option[];
  templates: TemplateOption[];
  readOnly: boolean;
  allowPerSqft: boolean;
  allowBedsBaths: boolean;
  draft?: boolean;
}) {
  const [state, action, pending] = useActionState(saveInstantBookingOffer, initial);
  const [retireState, retireAction, retirePending] = useActionState(
    deactivateInstantBookingOffer,
    initial,
  );
  const [pricing, setPricing] = useState<PricingMethod>(offer.pricingMethod);
  useFeedbackToast({
    error: state.error ?? retireState.error,
    success: state.success || retireState.success,
    pending: pending || retirePending,
  });
  const disabled = readOnly || pending;
  const title = draft ? 'Add a service' : offer.name || 'Service';

  return (
    <article className={draft ? `${styles.offerCard} ${styles.offerDraft}` : styles.offerCard}>
      <form action={action} className={styles.offerList}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        {offer.id ? <input type="hidden" name="offer_id" value={offer.id} /> : null}
        <div className={styles.offerHead}>
          <div>
            <h3 className={styles.offerTitle}>{title}</h3>
            <p className={styles.offerMeta}>
              {draft
                ? 'This is what customers see on the public page.'
                : `${offer.durationMinutes} min · ${priceSummary(offer)} · ${offer.isActive ? 'Bookable' : 'Hidden'}`}
            </p>
          </div>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={offer.isActive}
              disabled={disabled}
            />
            Bookable
          </label>
        </div>
        <div className={styles.fieldGrid}>
          <label className={styles.field}>
            Name
            <input name="name" required defaultValue={offer.name} disabled={disabled} />
          </label>
          <label className={styles.field}>
            Duration (minutes)
            <input
              name="duration_minutes"
              type="number"
              min={15}
              max={720}
              defaultValue={offer.durationMinutes}
              disabled={disabled}
            />
          </label>
          <label className={styles.field}>
            Pricing
            <select
              name="pricing_method"
              value={pricing}
              onChange={(event) => setPricing(event.target.value as PricingMethod)}
              disabled={disabled}
            >
              <option value="flat">Flat rate</option>
              {allowPerSqft || offer.pricingMethod === 'per_sqft' ? (
                <option value="per_sqft">Base plus per square foot</option>
              ) : null}
              {allowBedsBaths || offer.pricingMethod === 'beds_baths' ? (
                <option value="beds_baths">Base plus beds and baths</option>
              ) : null}
            </select>
          </label>
        </div>
        <div className={`${styles.fieldGrid} ${styles.fieldGridFour}`}>
          <label className={styles.field}>
            Base price (dollars)
            <input name="base_dollars" defaultValue={offer.baseDollars} disabled={disabled} />
          </label>
          <label className={styles.field} hidden={pricing !== 'per_sqft'}>
            Per sq ft (dollars)
            <input
              name="per_sqft_dollars"
              defaultValue={offer.perSqftDollars}
              disabled={disabled}
            />
          </label>
          <label className={styles.field} hidden={pricing !== 'beds_baths'}>
            Per bedroom (dollars)
            <input
              name="per_bedroom_dollars"
              defaultValue={offer.perBedroomDollars}
              disabled={disabled}
            />
          </label>
          <label className={styles.field} hidden={pricing !== 'beds_baths'}>
            Per bathroom (dollars)
            <input
              name="per_bathroom_dollars"
              defaultValue={offer.perBathroomDollars}
              disabled={disabled}
            />
          </label>
          <label className={styles.field}>
            Service plan
            <select name="service_plan_id" defaultValue={offer.servicePlanId} disabled={disabled}>
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
              disabled={disabled}
            >
              <option value="">None</option>
              {groupedTemplates(templates).map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>
        {zones.length > 0 ? (
          <fieldset>
            <legend className={styles.sectionTitle}>Limit to zones</legend>
            <p className={styles.sectionLead}>
              Leave every zone off to offer this service everywhere.
            </p>
            <div className={styles.toggleGrid}>
              {zones.map((zone) => (
                <label key={zone.id} className={styles.toggle}>
                  <input
                    type="checkbox"
                    name="zone_ids"
                    value={zone.id}
                    defaultChecked={offer.zoneIds.includes(zone.id)}
                    disabled={disabled}
                  />
                  {zone.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {!readOnly ? (
          <div className={styles.offerActions}>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? 'Saving…' : offer.id ? 'Update service' : 'Add service'}
            </Button>
          </div>
        ) : null}
      </form>
      {offer.id && offer.isActive && !readOnly ? (
        <form action={retireAction}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="offer_id" value={offer.id} />
          <Button type="submit" variant="secondary" disabled={retirePending}>
            {retirePending ? 'Stopping…' : 'Stop offering'}
          </Button>
        </form>
      ) : null}
    </article>
  );
}

export function InstantBookingOffers({
  tenantSlug,
  offers,
  zones,
  plans,
  templates,
  readOnly,
  allowPerSqft,
  allowBedsBaths,
}: {
  tenantSlug: string;
  offers: OfferDraft[];
  zones: Zone[];
  plans: Option[];
  templates: TemplateOption[];
  readOnly: boolean;
  allowPerSqft: boolean;
  allowBedsBaths: boolean;
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
    <section id="booking-services" className={styles.services}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Services</h2>
        <p className={styles.sectionLead}>
          Each card is one visit a customer can book. Hidden services stay here and drop off the
          public page.
        </p>
      </div>
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
            allowPerSqft={allowPerSqft}
            allowBedsBaths={allowBedsBaths}
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
            allowPerSqft={allowPerSqft}
            allowBedsBaths={allowBedsBaths}
            draft
          />
        ) : null}
      </div>
    </section>
  );
}
