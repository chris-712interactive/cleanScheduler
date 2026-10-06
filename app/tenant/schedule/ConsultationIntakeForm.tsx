'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { saveConsultationIntakeAction } from './visitFieldActions';
import {
  CONSULTATION_ADDONS,
  CONSULTATION_AFTER_HOURS_ACCESS,
  CONSULTATION_CONDITIONS,
  CONSULTATION_FLOORS,
  CONSULTATION_FREQUENCIES,
  CONSULTATION_LAST_CLEAN,
  CONSULTATION_ON_SITE,
  CONSULTATION_PETS,
  CONSULTATION_SERVICES,
  CONSULTATION_SPACE_TYPES,
  CONSULTATION_SUPPLIES,
  consultationUsesCommercialFields,
  formatConsultationIntakeSummary,
  type ConsultationIntake,
  type ConsultationIntakeFieldKey,
} from '@/lib/visits/consultationIntake';
import type { CustomerPropertyKind } from '@/lib/tenant/propertyKindLabels';
import { PROPERTY_KIND_LABEL } from '@/lib/tenant/propertyKindLabels';
import styles from './visitDetail.module.scss';

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={styles.intakeField} htmlFor={htmlFor}>
      <span>
        {label}
        {required ? <span aria-hidden> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function yesNoDefault(value: boolean | null | undefined): string {
  if (value == null) return '';
  return value ? 'yes' : 'no';
}

export function ConsultationIntakeForm({
  tenantSlug,
  visitId,
  propertyKind,
  initial,
  canEdit,
  requiredFields = [],
}: {
  tenantSlug: string;
  visitId: string;
  propertyKind: CustomerPropertyKind;
  initial: ConsultationIntake | null;
  canEdit: boolean;
  requiredFields?: readonly ConsultationIntakeFieldKey[];
}) {
  const [state, action, pending] = useActionState(saveConsultationIntakeAction, {});
  const [frequency, setFrequency] = useState(initial?.frequency ?? '');
  const [pets, setPets] = useState(initial?.pets ?? '');
  const commercial = consultationUsesCommercialFields(propertyKind);
  const required = new Set<string>(requiredFields);
  const req = (key: ConsultationIntakeFieldKey) => required.has(key);

  if (!canEdit) {
    return (
      <section className={styles.intake} aria-label="Consultation details">
        <h2>Consultation details</h2>
        {initial ? (
          <p className={styles.intakeSummary}>{formatConsultationIntakeSummary(initial)}</p>
        ) : (
          <p className={styles.intakeHint}>No consultation details have been saved yet.</p>
        )}
      </section>
    );
  }

  return (
    <form action={action} className={styles.intake}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="visit_id" value={visitId} />
      <div>
        <h2>Consultation details</h2>
        <p className={styles.intakeHint}>
          {PROPERTY_KIND_LABEL[propertyKind]}. Fields marked with * are required by this company.
          Save the details the office needs to price the quote.
        </p>
      </div>

      <fieldset className={styles.intakeGroup}>
        <legend>The job</legend>
        <Field
          label="Service requested"
          htmlFor="service_requested"
          required={req('service_requested')}
        >
          <select
            id="service_requested"
            name="service_requested"
            defaultValue={initial?.serviceRequested ?? ''}
            required={req('service_requested')}
          >
            <option value="">Select</option>
            {CONSULTATION_SERVICES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="How often" htmlFor="frequency" required={req('frequency')}>
          <select
            id="frequency"
            name="frequency"
            value={frequency}
            required={req('frequency')}
            onChange={(event) => setFrequency(event.target.value)}
          >
            <option value="">Select</option>
            {CONSULTATION_FREQUENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        {frequency === 'custom' ? (
          <Field label="Custom cadence" htmlFor="frequency_detail" required>
            <input
              id="frequency_detail"
              name="frequency_detail"
              defaultValue={initial?.frequencyDetail ?? ''}
              required
              placeholder="Every 3 weeks"
            />
          </Field>
        ) : null}
        <Field label="Square footage" htmlFor="sqft" required={req('sqft')}>
          <input
            id="sqft"
            name="sqft"
            inputMode="numeric"
            defaultValue={initial?.sqft ?? ''}
            required={req('sqft')}
            placeholder="1800"
          />
        </Field>
        <Field label="Current condition" htmlFor="condition" required={req('condition')}>
          <select
            id="condition"
            name="condition"
            defaultValue={initial?.condition ?? ''}
            required={req('condition')}
          >
            <option value="">Select</option>
            {CONSULTATION_CONDITIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Supplies" htmlFor="supplies" required={req('supplies')}>
          <select
            id="supplies"
            name="supplies"
            defaultValue={initial?.supplies ?? ''}
            required={req('supplies')}
          >
            <option value="">Select</option>
            {CONSULTATION_SUPPLIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Preferred start" htmlFor="preferred_start" required={req('preferred_start')}>
          <input
            id="preferred_start"
            name="preferred_start"
            type="date"
            defaultValue={initial?.preferredStart ?? ''}
            required={req('preferred_start')}
          />
        </Field>
        <Field label="Areas in scope" htmlFor="areas_in_scope" required={req('areas_in_scope')}>
          <textarea
            id="areas_in_scope"
            name="areas_in_scope"
            rows={3}
            required={req('areas_in_scope')}
            defaultValue={initial?.areasInScope ?? ''}
            placeholder="One area per line"
          />
        </Field>
        <Field
          label="Areas out of scope"
          htmlFor="areas_out_of_scope"
          required={req('areas_out_of_scope')}
        >
          <textarea
            id="areas_out_of_scope"
            name="areas_out_of_scope"
            rows={2}
            required={req('areas_out_of_scope')}
            defaultValue={initial?.areasOutOfScope ?? ''}
          />
        </Field>
      </fieldset>

      {commercial ? (
        <fieldset className={styles.intakeGroup}>
          <legend>The space</legend>
          <Field label="Space type" htmlFor="space_type" required={req('space_type')}>
            <select
              id="space_type"
              name="space_type"
              defaultValue={initial?.spaceType ?? ''}
              required={req('space_type')}
            >
              <option value="">Select</option>
              {CONSULTATION_SPACE_TYPES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Restrooms" htmlFor="restrooms" required={req('restrooms')}>
            <input
              id="restrooms"
              name="restrooms"
              inputMode="numeric"
              defaultValue={initial?.restrooms ?? ''}
              required={req('restrooms')}
            />
          </Field>
          <Field
            label="Break rooms or kitchens"
            htmlFor="break_rooms"
            required={req('break_rooms')}
          >
            <input
              id="break_rooms"
              name="break_rooms"
              inputMode="numeric"
              defaultValue={initial?.breakRooms ?? ''}
              required={req('break_rooms')}
            />
          </Field>
          <Field
            label="Stories or suites"
            htmlFor="stories_or_suites"
            required={req('stories_or_suites')}
          >
            <input
              id="stories_or_suites"
              name="stories_or_suites"
              inputMode="numeric"
              defaultValue={initial?.storiesOrSuites ?? ''}
              required={req('stories_or_suites')}
            />
          </Field>
          <Field
            label="When the crew can be on site"
            htmlFor="on_site_window"
            required={req('on_site_window')}
          >
            <select
              id="on_site_window"
              name="on_site_window"
              defaultValue={initial?.onSiteWindow ?? ''}
              required={req('on_site_window')}
            >
              <option value="">Select</option>
              {CONSULTATION_ON_SITE.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="After-hours access"
            htmlFor="after_hours_access"
            required={req('after_hours_access')}
          >
            <select
              id="after_hours_access"
              name="after_hours_access"
              defaultValue={initial?.afterHoursAccess ?? ''}
              required={req('after_hours_access')}
            >
              <option value="">Select</option>
              {CONSULTATION_AFTER_HOURS_ACCESS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Employee or occupant count" htmlFor="occupant_count">
            <input
              id="occupant_count"
              name="occupant_count"
              inputMode="numeric"
              defaultValue={initial?.occupantCount ?? ''}
            />
          </Field>
          <Field label="Trash and recycling locations" htmlFor="trash_locations">
            <input
              id="trash_locations"
              name="trash_locations"
              defaultValue={initial?.trashLocations ?? ''}
            />
          </Field>
          <Field label="Restock paper and soap" htmlFor="restock_restrooms">
            <select
              id="restock_restrooms"
              name="restock_restrooms"
              defaultValue={yesNoDefault(initial?.restockRestrooms)}
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Requested crew size" htmlFor="crew_headcount">
            <input
              id="crew_headcount"
              name="crew_headcount"
              inputMode="numeric"
              defaultValue={initial?.crewHeadcount ?? ''}
            />
          </Field>
        </fieldset>
      ) : (
        <fieldset className={styles.intakeGroup}>
          <legend>The home</legend>
          <Field label="Bedrooms" htmlFor="bedrooms" required={req('bedrooms')}>
            <input
              id="bedrooms"
              name="bedrooms"
              inputMode="numeric"
              defaultValue={initial?.bedrooms ?? ''}
              required={req('bedrooms')}
            />
          </Field>
          <Field label="Bathrooms" htmlFor="bathrooms" required={req('bathrooms')}>
            <input
              id="bathrooms"
              name="bathrooms"
              inputMode="decimal"
              defaultValue={initial?.bathrooms ?? ''}
              required={req('bathrooms')}
              placeholder="2.5"
            />
          </Field>
          <Field label="Stories" htmlFor="stories" required={req('stories')}>
            <input
              id="stories"
              name="stories"
              inputMode="numeric"
              defaultValue={initial?.stories ?? ''}
              required={req('stories')}
            />
          </Field>
          <Field label="Pets" htmlFor="pets" required={req('pets')}>
            <select
              id="pets"
              name="pets"
              required={req('pets')}
              value={pets}
              onChange={(event) => setPets(event.target.value)}
            >
              <option value="">Select</option>
              {CONSULTATION_PETS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          {pets && pets !== 'none' ? (
            <Field label="Pet count" htmlFor="pet_count" required>
              <input
                id="pet_count"
                name="pet_count"
                inputMode="numeric"
                defaultValue={initial?.petCount ?? ''}
                required
              />
            </Field>
          ) : null}
          <Field
            label="Home occupied during the clean"
            htmlFor="occupied_during_clean"
            required={req('occupied_during_clean')}
          >
            <select
              id="occupied_during_clean"
              name="occupied_during_clean"
              defaultValue={yesNoDefault(initial?.occupiedDuringClean)}
              required={req('occupied_during_clean')}
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Kids at home" htmlFor="kids_at_home">
            <select
              id="kids_at_home"
              name="kids_at_home"
              defaultValue={yesNoDefault(initial?.kidsAtHome)}
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Home office" htmlFor="home_office">
            <select
              id="home_office"
              name="home_office"
              defaultValue={yesNoDefault(initial?.homeOffice)}
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Same cleaner each visit" htmlFor="same_cleaner">
            <select
              id="same_cleaner"
              name="same_cleaner"
              defaultValue={yesNoDefault(initial?.sameCleaner)}
            >
              <option value="">Select</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        </fieldset>
      )}

      <fieldset className={styles.intakeGroup}>
        <legend>Optional</legend>
        <div className={styles.intakeChecks}>
          <span>Add-ons</span>
          {CONSULTATION_ADDONS.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                name="addons"
                value={option.value}
                defaultChecked={initial?.addons.includes(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        <div className={styles.intakeChecks}>
          <span>Floor types</span>
          {CONSULTATION_FLOORS.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                name="floor_types"
                value={option.value}
                defaultChecked={initial?.floorTypes.includes(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
        <Field label="Last professional clean" htmlFor="last_professional_clean">
          <select
            id="last_professional_clean"
            name="last_professional_clean"
            defaultValue={initial?.lastProfessionalClean ?? ''}
          >
            <option value="">Select</option>
            {CONSULTATION_LAST_CLEAN.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Parking and entry" htmlFor="parking_and_entry">
          <textarea
            id="parking_and_entry"
            name="parking_and_entry"
            rows={2}
            defaultValue={initial?.parkingAndEntry ?? ''}
          />
        </Field>
        <Field label="Special requests" htmlFor="special_requests">
          <textarea
            id="special_requests"
            name="special_requests"
            rows={2}
            defaultValue={initial?.specialRequests ?? ''}
          />
        </Field>
        <Field label="Photo notes" htmlFor="photo_notes">
          <textarea
            id="photo_notes"
            name="photo_notes"
            rows={2}
            defaultValue={initial?.photoNotes ?? ''}
          />
        </Field>
        <Field label="Crew estimate (hours)" htmlFor="crew_estimate_hours">
          <input
            id="crew_estimate_hours"
            name="crew_estimate_hours"
            inputMode="decimal"
            defaultValue={initial?.crewEstimateHours ?? ''}
            placeholder="3.5"
          />
        </Field>
      </fieldset>

      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className={styles.ok}>{state.success}</p> : null}
      <button type="submit" className={styles.intakeSave} disabled={pending}>
        {pending ? 'Saving…' : 'Save consultation details'}
      </button>
    </form>
  );
}
