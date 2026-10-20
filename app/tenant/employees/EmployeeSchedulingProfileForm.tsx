'use client';

import { useActionState, useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { missingGeocodeMessage } from '@/lib/geo/geocodeStatus';
import { formatTagList } from '@/lib/schedule/optimizer/preferences';
import type { CrewSchedulingProfile } from '@/lib/schedule/optimizer/crewProfile';
import {
  updateCrewSchedulingProfileAction,
  type CrewSchedulingActionState,
} from './crewSchedulingActions';
import styles from '../customers/scheduling-fields.module.scss';

const initial: CrewSchedulingActionState = {};

const EXPERIENCE = [
  { value: 'new', title: 'New', hint: 'Still learning the work' },
  { value: 'standard', title: 'Standard', hint: 'Typical jobs' },
  { value: 'lead', title: 'Lead', hint: 'Can lead a crew' },
] as const;

const KINDS = [
  { id: 'residential', label: 'Residential' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'short_term_rental', label: 'Short-term rental' },
] as const;

function experienceTitle(value: string): string {
  return EXPERIENCE.find((option) => option.value === value)?.title ?? 'Standard';
}

function limitsSummary(
  experience: string,
  maxJobs: string,
  maxMinutes: string,
  maxDrive: string,
  jobLabel: string,
): string {
  const parts = [experienceTitle(experience)];
  if (maxJobs.trim()) parts.push(`${maxJobs.trim()} ${jobLabel}`);
  if (maxMinutes.trim()) parts.push(`${maxMinutes.trim()} min`);
  if (maxDrive.trim()) parts.push(`${maxDrive.trim()} min drive`);
  return parts.join(' · ');
}

function filledSummary(values: string[]): string {
  const filled = values.map((value) => value.trim()).filter(Boolean);
  return filled.join(' · ') || 'None added';
}

function placesSummary(
  kinds: string[],
  pets: boolean,
  fragranceFree: boolean,
  zoneCount: number,
): string {
  const kindLabels = KINDS.filter((kind) => kinds.includes(kind.id)).map((kind) => kind.label);
  const parts = [kindLabels.length > 0 ? kindLabels.join(', ') : 'Every property type'];
  if (pets) parts.push('Pets');
  if (fragranceFree) parts.push('Fragrance-free');
  if (zoneCount > 0) parts.push(zoneCount === 1 ? '1 zone' : `${zoneCount} zones`);
  return parts.join(' · ');
}

function teammatesSummary(preferred: number, avoided: number): string {
  const parts: string[] = [];
  if (preferred > 0) parts.push(preferred === 1 ? '1 preferred' : `${preferred} preferred`);
  if (avoided > 0) parts.push(avoided === 1 ? '1 to avoid' : `${avoided} to avoid`);
  return parts.join(' · ') || 'Any teammate';
}

function homeSummary(line1: string, city: string, state: string): string {
  const place = [city.trim(), state.trim()].filter(Boolean).join(', ');
  return place || line1.trim() || 'No home address';
}

function toggleId(current: string[], id: string, checked: boolean): string[] {
  if (checked) return current.includes(id) ? current : [...current, id];
  return current.filter((item) => item !== id);
}

function profileSnapshot(profile: CrewSchedulingProfile): string {
  return JSON.stringify({
    experience: profile.experienceLevel,
    jobs: profile.maxJobsPerDay,
    minutes: profile.maxMinutesPerDay,
    drive: profile.maxDriveMinutes,
    skills: profile.skillTags,
    certifications: profile.certificationTags,
    equipment: profile.equipmentTags,
    languages: profile.languageCodes,
    attributes: profile.attributeTags,
    kinds: profile.propertyKinds,
    pets: profile.handlesPets,
    fragrance: profile.handlesChemicalSensitivity,
    zones: profile.preferredZoneIds,
    preferred: profile.preferredPartnerIds,
    avoided: profile.avoidPartnerIds,
    line1: profile.homeAddressLine1,
    city: profile.homeCity,
    state: profile.homeState,
    postal: profile.homePostalCode,
  });
}

export function EmployeeSchedulingProfileForm({
  tenantSlug,
  targetUserId,
  profile,
  zones,
  partners,
  scope = 'full',
  homeGeocode = null,
}: {
  tenantSlug: string;
  targetUserId: string;
  profile: CrewSchedulingProfile;
  zones: { id: string; label: string }[];
  partners: { id: string; label: string }[];
  /** Consultation keeps travel and language. Full includes job skills and crew pairing. */
  scope?: 'full' | 'consultation';
  homeGeocode?: {
    reason: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
}) {
  const [state, action, pending] = useActionState(updateCrewSchedulingProfileAction, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });
  const saved = profileSnapshot(profile);
  const full = scope === 'full';
  const jobLabel = full ? 'jobs' : 'visits';
  const homeGeocodeMessage = missingGeocodeMessage({
    reason: homeGeocode?.reason,
    latitude: homeGeocode?.latitude,
    longitude: homeGeocode?.longitude,
    addressParts: [
      profile.homeAddressLine1,
      profile.homeCity,
      profile.homeState,
      profile.homePostalCode,
    ],
  });

  const [limitsOpen, setLimitsOpen] = useState(true);
  const [experience, setExperience] = useState(profile.experienceLevel);
  const [maxJobs, setMaxJobs] = useState(profile.maxJobsPerDay?.toString() ?? '');
  const [maxMinutes, setMaxMinutes] = useState(profile.maxMinutesPerDay?.toString() ?? '');
  const [maxDrive, setMaxDrive] = useState(profile.maxDriveMinutes?.toString() ?? '');
  const [skills, setSkills] = useState(formatTagList(profile.skillTags));
  const [certifications, setCertifications] = useState(formatTagList(profile.certificationTags));
  const [equipment, setEquipment] = useState(formatTagList(profile.equipmentTags));
  const [languages, setLanguages] = useState(formatTagList(profile.languageCodes));
  const [attributes, setAttributes] = useState(formatTagList(profile.attributeTags));
  const [kinds, setKinds] = useState(profile.propertyKinds);
  const [pets, setPets] = useState(profile.handlesPets);
  const [fragranceFree, setFragranceFree] = useState(profile.handlesChemicalSensitivity);
  const [zoneIds, setZoneIds] = useState(profile.preferredZoneIds);
  const [preferredIds, setPreferredIds] = useState(profile.preferredPartnerIds);
  const [avoidedIds, setAvoidedIds] = useState(profile.avoidPartnerIds);
  const [line1, setLine1] = useState(profile.homeAddressLine1);
  const [city, setCity] = useState(profile.homeCity);
  const [region, setRegion] = useState(profile.homeState);
  const [postal, setPostal] = useState(profile.homePostalCode);

  useEffect(() => {
    const next = JSON.parse(saved) as {
      experience: string;
      jobs: number | null;
      minutes: number | null;
      drive: number | null;
      skills: string[];
      certifications: string[];
      equipment: string[];
      languages: string[];
      attributes: string[];
      kinds: string[];
      pets: boolean;
      fragrance: boolean;
      zones: string[];
      preferred: string[];
      avoided: string[];
      line1: string;
      city: string;
      state: string;
      postal: string;
    };
    setExperience(next.experience);
    setMaxJobs(next.jobs?.toString() ?? '');
    setMaxMinutes(next.minutes?.toString() ?? '');
    setMaxDrive(next.drive?.toString() ?? '');
    setSkills(formatTagList(next.skills));
    setCertifications(formatTagList(next.certifications));
    setEquipment(formatTagList(next.equipment));
    setLanguages(formatTagList(next.languages));
    setAttributes(formatTagList(next.attributes));
    setKinds(next.kinds);
    setPets(next.pets);
    setFragranceFree(next.fragrance);
    setZoneIds(next.zones);
    setPreferredIds(next.preferred);
    setAvoidedIds(next.avoided);
    setLine1(next.line1);
    setCity(next.city);
    setRegion(next.state);
    setPostal(next.postal);
  }, [saved]);

  return (
    <form action={action} className={styles.fields}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="target_user_id" value={targetUserId} />
      {full ? null : <input type="hidden" name="profile_scope" value="consultation" />}

      <div className={styles.sectionWrap}>
        <details
          className={styles.section}
          open={limitsOpen}
          onToggle={(event) => setLimitsOpen(event.currentTarget.open)}
        >
          <summary className={styles.sectionSummary}>
            <span className={styles.sectionTitle}>Limits</span>
            <span className={styles.sectionHint}>
              {limitsSummary(experience, maxJobs, maxMinutes, maxDrive, jobLabel)}
            </span>
          </summary>
          <div className={styles.sectionBody}>
            <fieldset className={styles.block}>
              <legend className={styles.legend}>Experience</legend>
              <div className={styles.choiceGrid}>
                {EXPERIENCE.map((option) => {
                  const selected = experience === option.value;
                  return (
                    <label
                      key={option.value}
                      className={styles.timeCard}
                      data-selected={selected || undefined}
                    >
                      <input
                        type="radio"
                        name="experience_level"
                        value={option.value}
                        checked={selected}
                        onChange={() => setExperience(option.value)}
                      />
                      <span className={styles.timeTitle}>{option.title}</span>
                      <span className={styles.timeHint}>{option.hint}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className={styles.grid}>
              <label className={styles.field}>
                {full ? 'Max jobs per day' : 'Max consultations per day'}
                <input
                  type="number"
                  name="max_jobs_per_day"
                  min={1}
                  max={20}
                  value={maxJobs}
                  placeholder="No cap"
                  onChange={(event) => setMaxJobs(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                Max minutes per day
                <input
                  type="number"
                  name="max_minutes_per_day"
                  min={30}
                  max={960}
                  value={maxMinutes}
                  placeholder="No cap"
                  onChange={(event) => setMaxMinutes(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                Max drive between stops
                <input
                  type="number"
                  name="max_drive_minutes"
                  min={5}
                  max={180}
                  value={maxDrive}
                  placeholder="Company default"
                  onChange={(event) => setMaxDrive(event.target.value)}
                />
              </label>
            </div>
            <p className={styles.note}>Drive time is in minutes. Leave a box blank for no cap.</p>
          </div>
        </details>
      </div>

      <div className={styles.sectionWrap}>
        <details className={styles.section}>
          <summary className={styles.sectionSummary}>
            <span className={styles.sectionTitle}>{full ? 'Skills' : 'Languages'}</span>
            <span className={styles.sectionHint}>
              {filledSummary(
                full ? [skills, certifications, equipment, languages, attributes] : [languages],
              )}
            </span>
          </summary>
          <div className={styles.sectionBody}>
            <div className={styles.grid}>
              {full ? (
                <>
                  <label className={styles.field}>
                    Skills
                    <input
                      name="skill_tags"
                      value={skills}
                      placeholder="floor-care, deep-clean"
                      onChange={(event) => setSkills(event.target.value)}
                    />
                  </label>
                  <label className={styles.field}>
                    Certifications
                    <input
                      name="certification_tags"
                      value={certifications}
                      placeholder="osha"
                      onChange={(event) => setCertifications(event.target.value)}
                    />
                  </label>
                  <label className={styles.field}>
                    Equipment
                    <input
                      name="equipment_tags"
                      value={equipment}
                      placeholder="floor-buffer"
                      onChange={(event) => setEquipment(event.target.value)}
                    />
                  </label>
                </>
              ) : null}
              <label className={styles.field}>
                Languages
                <input
                  name="language_codes"
                  value={languages}
                  placeholder="spanish"
                  onChange={(event) => setLanguages(event.target.value)}
                />
              </label>
              {full ? (
                <label className={styles.field}>
                  Entry tags
                  <input
                    name="attribute_tags"
                    value={attributes}
                    placeholder="female, non-smoker"
                    onChange={(event) => setAttributes(event.target.value)}
                  />
                </label>
              ) : null}
            </div>
            <p className={styles.note}>
              Separate items with commas. Leave a list blank if it does not apply.
            </p>
          </div>
        </details>
      </div>

      {full ? (
        <div className={styles.sectionWrap}>
          <details className={styles.section}>
            <summary className={styles.sectionSummary}>
              <span className={styles.sectionTitle}>Places</span>
              <span className={styles.sectionHint}>
                {placesSummary(kinds, pets, fragranceFree, zoneIds.length)}
              </span>
            </summary>
            <div className={styles.sectionBody}>
              <fieldset className={styles.block}>
                <legend className={styles.legend}>Property types</legend>
                <div className={styles.personList}>
                  {KINDS.map((kind) => {
                    const selected = kinds.includes(kind.id);
                    return (
                      <label
                        key={kind.id}
                        className={styles.person}
                        data-selected={selected || undefined}
                      >
                        <input
                          type="checkbox"
                          name="property_kind"
                          value={kind.id}
                          checked={selected}
                          onChange={(event) =>
                            setKinds((current) => toggleId(current, kind.id, event.target.checked))
                          }
                        />
                        {kind.label}
                      </label>
                    );
                  })}
                </div>
                <p className={styles.note}>Leave these off to allow every type.</p>
              </fieldset>
              <div className={styles.checks}>
                <label className={styles.check} data-selected={pets || undefined}>
                  <input
                    type="checkbox"
                    name="handles_pets"
                    checked={pets}
                    onChange={(event) => setPets(event.target.checked)}
                  />
                  Comfortable with pets
                </label>
                <label className={styles.check} data-selected={fragranceFree || undefined}>
                  <input
                    type="checkbox"
                    name="handles_chemical_sensitivity"
                    checked={fragranceFree}
                    onChange={(event) => setFragranceFree(event.target.checked)}
                  />
                  Can run a fragrance-free clean
                </label>
              </div>
              <fieldset className={styles.block}>
                <legend className={styles.legend}>Preferred zones</legend>
                {zones.length === 0 ? <p className={styles.empty}>No service zones yet.</p> : null}
                <div className={styles.personList}>
                  {zones.map((zone) => {
                    const selected = zoneIds.includes(zone.id);
                    return (
                      <label
                        key={zone.id}
                        className={styles.person}
                        data-selected={selected || undefined}
                      >
                        <input
                          type="checkbox"
                          name="preferred_zone_id"
                          value={zone.id}
                          checked={selected}
                          onChange={(event) =>
                            setZoneIds((current) =>
                              toggleId(current, zone.id, event.target.checked),
                            )
                          }
                        />
                        {zone.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </details>
        </div>
      ) : (
        <div className={styles.sectionWrap}>
          <details className={styles.section}>
            <summary className={styles.sectionSummary}>
              <span className={styles.sectionTitle}>Zones</span>
              <span className={styles.sectionHint}>
                {zoneIds.length === 0
                  ? 'Any zone'
                  : zoneIds.length === 1
                    ? '1 zone'
                    : `${zoneIds.length} zones`}
              </span>
            </summary>
            <div className={styles.sectionBody}>
              {zones.length === 0 ? <p className={styles.empty}>No service zones yet.</p> : null}
              <div className={styles.personList}>
                {zones.map((zone) => {
                  const selected = zoneIds.includes(zone.id);
                  return (
                    <label
                      key={zone.id}
                      className={styles.person}
                      data-selected={selected || undefined}
                    >
                      <input
                        type="checkbox"
                        name="preferred_zone_id"
                        value={zone.id}
                        checked={selected}
                        onChange={(event) =>
                          setZoneIds((current) => toggleId(current, zone.id, event.target.checked))
                        }
                      />
                      {zone.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </details>
        </div>
      )}

      {full ? (
        <div className={styles.sectionWrap}>
          <details className={styles.section}>
            <summary className={styles.sectionSummary}>
              <span className={styles.sectionTitle}>Teammates</span>
              <span className={styles.sectionHint}>
                {partners.length === 0
                  ? 'No other teammates'
                  : teammatesSummary(preferredIds.length, avoidedIds.length)}
              </span>
            </summary>
            <div className={styles.sectionBody}>
              {partners.length === 0 ? (
                <p className={styles.empty}>No other teammates yet.</p>
              ) : (
                <>
                  <fieldset className={styles.block}>
                    <legend className={styles.legend}>Prefer to work with</legend>
                    <div className={styles.personList}>
                      {partners.map((partner) => {
                        const selected = preferredIds.includes(partner.id);
                        return (
                          <label
                            key={`prefer-${partner.id}`}
                            className={styles.person}
                            data-selected={selected || undefined}
                          >
                            <input
                              type="checkbox"
                              name="preferred_partner_id"
                              value={partner.id}
                              checked={selected}
                              onChange={(event) =>
                                setPreferredIds((current) =>
                                  toggleId(current, partner.id, event.target.checked),
                                )
                              }
                            />
                            {partner.label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                  <fieldset className={styles.block}>
                    <legend className={styles.legend}>Avoid pairing with</legend>
                    <div className={styles.personList}>
                      {partners.map((partner) => {
                        const selected = avoidedIds.includes(partner.id);
                        return (
                          <label
                            key={`avoid-${partner.id}`}
                            className={styles.person}
                            data-selected={selected || undefined}
                          >
                            <input
                              type="checkbox"
                              name="avoid_partner_id"
                              value={partner.id}
                              checked={selected}
                              onChange={(event) =>
                                setAvoidedIds((current) =>
                                  toggleId(current, partner.id, event.target.checked),
                                )
                              }
                            />
                            {partner.label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>
                </>
              )}
            </div>
          </details>
        </div>
      ) : null}

      <div className={styles.sectionWrap}>
        <details className={styles.section}>
          <summary className={styles.sectionSummary}>
            <span className={styles.sectionTitle}>
              Home
              {homeGeocodeMessage ? (
                <span className={styles.geocodeBadge}>Missing map point</span>
              ) : null}
            </span>
            <span className={styles.sectionHint}>{homeSummary(line1, city, region)}</span>
          </summary>
          <div className={styles.sectionBody}>
            <p className={styles.note}>
              Used as a starting point for straight-line drive time. Leave it blank to skip that.
            </p>
            {homeGeocodeMessage ? <p className={styles.geocodeNote}>{homeGeocodeMessage}</p> : null}
            <div className={styles.grid}>
              <label className={styles.field}>
                Home address
                <input
                  name="home_address_line1"
                  value={line1}
                  autoComplete="address-line1"
                  onChange={(event) => setLine1(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                City
                <input
                  name="home_city"
                  value={city}
                  autoComplete="address-level2"
                  onChange={(event) => setCity(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                State
                <input
                  name="home_state"
                  value={region}
                  autoComplete="address-level1"
                  onChange={(event) => setRegion(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                Postal code
                <input
                  name="home_postal_code"
                  value={postal}
                  autoComplete="postal-code"
                  onChange={(event) => setPostal(event.target.value)}
                />
              </label>
            </div>
          </div>
        </details>
      </div>

      <div className={styles.saveRow}>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save scheduling profile'}
        </Button>
      </div>
    </form>
  );
}
