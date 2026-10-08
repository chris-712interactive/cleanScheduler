'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { formatTagList } from '@/lib/schedule/optimizer/preferences';
import type { CrewSchedulingProfile } from '@/lib/schedule/optimizer/crewProfile';
import {
  updateCrewSchedulingProfileAction,
  type CrewSchedulingActionState,
} from './crewSchedulingActions';
import styles from '../customers/scheduling-fields.module.scss';

const initial: CrewSchedulingActionState = {};

const KINDS = [
  { id: 'residential', label: 'Residential' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'short_term_rental', label: 'Short-term rental' },
] as const;

export function EmployeeSchedulingProfileForm({
  tenantSlug,
  targetUserId,
  profile,
  zones,
  partners,
}: {
  tenantSlug: string;
  targetUserId: string;
  profile: CrewSchedulingProfile;
  zones: { id: string; label: string }[];
  partners: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(updateCrewSchedulingProfileAction, initial);
  const kinds = new Set(profile.propertyKinds);
  const zoneIds = new Set(profile.preferredZoneIds);
  const preferred = new Set(profile.preferredPartnerIds);
  const avoided = new Set(profile.avoidPartnerIds);

  return (
    <form action={action} className={styles.stack}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="target_user_id" value={targetUserId} />
      <p className={styles.lead}>
        Used when the schedule suggests who should take a job. Leave a list blank if it does not
        apply. Home address is turned into a point for straight-line drive time.
      </p>

      <div className={styles.grid}>
        <label className={styles.field}>
          Experience
          <select name="experience_level" defaultValue={profile.experienceLevel}>
            <option value="new">New</option>
            <option value="standard">Standard</option>
            <option value="lead">Lead</option>
          </select>
        </label>
        <label className={styles.field}>
          Max jobs per day
          <input
            type="number"
            name="max_jobs_per_day"
            min={1}
            max={20}
            defaultValue={profile.maxJobsPerDay ?? ''}
            placeholder="No cap"
          />
        </label>
        <label className={styles.field}>
          Max minutes per day
          <input
            type="number"
            name="max_minutes_per_day"
            min={30}
            max={960}
            defaultValue={profile.maxMinutesPerDay ?? ''}
            placeholder="No cap"
          />
        </label>
        <label className={styles.field}>
          Max drive between stops (minutes)
          <input
            type="number"
            name="max_drive_minutes"
            min={5}
            max={180}
            defaultValue={profile.maxDriveMinutes ?? ''}
            placeholder="Company default"
          />
        </label>
        <label className={styles.field}>
          Skills
          <input
            name="skill_tags"
            defaultValue={formatTagList(profile.skillTags)}
            placeholder="floor-care, deep-clean"
          />
        </label>
        <label className={styles.field}>
          Certifications
          <input
            name="certification_tags"
            defaultValue={formatTagList(profile.certificationTags)}
            placeholder="osha"
          />
        </label>
        <label className={styles.field}>
          Equipment
          <input
            name="equipment_tags"
            defaultValue={formatTagList(profile.equipmentTags)}
            placeholder="floor-buffer"
          />
        </label>
        <label className={styles.field}>
          Languages
          <input
            name="language_codes"
            defaultValue={formatTagList(profile.languageCodes)}
            placeholder="spanish"
          />
        </label>
        <label className={styles.field}>
          Entry tags
          <input
            name="attribute_tags"
            defaultValue={formatTagList(profile.attributeTags)}
            placeholder="female, non-smoker"
          />
        </label>
      </div>

      <fieldset className={styles.people}>
        <legend>Property types</legend>
        <p className={styles.lead}>Leave these unchecked to allow every type.</p>
        <div className={styles.checks}>
          {KINDS.map((kind) => (
            <label key={kind.id}>
              <input
                type="checkbox"
                name="property_kind"
                value={kind.id}
                defaultChecked={kinds.has(kind.id)}
              />
              {kind.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.checks}>
        <label>
          <input type="checkbox" name="handles_pets" defaultChecked={profile.handlesPets} />{' '}
          Comfortable with pets
        </label>
        <label>
          <input
            type="checkbox"
            name="handles_chemical_sensitivity"
            defaultChecked={profile.handlesChemicalSensitivity}
          />{' '}
          Can run a fragrance-free clean
        </label>
      </div>

      <fieldset className={styles.people}>
        <legend>Preferred zones</legend>
        <div className={styles.peopleGrid}>
          {zones.length === 0 ? <p className={styles.empty}>No service zones yet.</p> : null}
          {zones.map((zone) => (
            <label key={zone.id}>
              <input
                type="checkbox"
                name="preferred_zone_id"
                value={zone.id}
                defaultChecked={zoneIds.has(zone.id)}
              />
              {zone.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.people}>
        <legend>Preferred partners</legend>
        <div className={styles.peopleGrid}>
          {partners.map((partner) => (
            <label key={`prefer-${partner.id}`}>
              <input
                type="checkbox"
                name="preferred_partner_id"
                value={partner.id}
                defaultChecked={preferred.has(partner.id)}
              />
              {partner.label}
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className={styles.people}>
        <legend>Avoid pairing with</legend>
        <div className={styles.peopleGrid}>
          {partners.map((partner) => (
            <label key={`avoid-${partner.id}`}>
              <input
                type="checkbox"
                name="avoid_partner_id"
                value={partner.id}
                defaultChecked={avoided.has(partner.id)}
              />
              {partner.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.grid}>
        <label className={styles.field}>
          Home address
          <input name="home_address_line1" defaultValue={profile.homeAddressLine1} />
        </label>
        <label className={styles.field}>
          City
          <input name="home_city" defaultValue={profile.homeCity} />
        </label>
        <label className={styles.field}>
          State
          <input name="home_state" defaultValue={profile.homeState} />
        </label>
        <label className={styles.field}>
          Postal code
          <input name="home_postal_code" defaultValue={profile.homePostalCode} />
        </label>
      </div>

      {state.error ? <p className={styles.bannerError}>{state.error}</p> : null}
      {state.success ? <p className={styles.bannerSuccess}>Saved.</p> : null}
      <div>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save scheduling profile'}
        </Button>
      </div>
    </form>
  );
}
