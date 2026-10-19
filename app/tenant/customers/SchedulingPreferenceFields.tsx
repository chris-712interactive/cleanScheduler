'use client';

import { useEffect, useState } from 'react';
import {
  formatTagList,
  timeInputValue,
  type PreferredTimeWindow,
  type SchedulingFacts,
} from '@/lib/schedule/optimizer/preferences';
import {
  WORK_WEEK_DAY_KEYS,
  WORK_WEEK_DAY_LABEL,
  type WorkWeekDayKey,
} from '@/lib/tenant/tenantBusinessSettings';
import styles from './scheduling-fields.module.scss';

const DAY_NAME: Record<WorkWeekDayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

const TIME_OPTIONS: Array<{
  value: '' | PreferredTimeWindow;
  title: string;
  hint: string;
}> = [
  { value: '', title: 'Any time', hint: 'Whenever the day allows' },
  { value: 'morning', title: 'Morning', hint: 'From about 8:00' },
  { value: 'afternoon', title: 'Afternoon', hint: 'From about noon' },
  { value: 'evening', title: 'Evening', hint: 'From about 4:00' },
];

function whenSummary(days: WorkWeekDayKey[], timeOfDay: string): string {
  const ordered = WORK_WEEK_DAY_KEYS.filter((day) => days.includes(day));
  const dayText =
    ordered.length === 0
      ? 'Any open day'
      : ordered.length === 7
        ? 'Every day'
        : ordered.map((day) => WORK_WEEK_DAY_LABEL[day]).join(', ');
  const timeText =
    timeOfDay === 'morning'
      ? 'Morning'
      : timeOfDay === 'afternoon'
        ? 'Afternoon'
        : timeOfDay === 'evening'
          ? 'Evening'
          : 'Any time';
  return `${dayText} · ${timeText}`;
}

function clockLabel(value: string): string {
  const match = value.match(/^(\d{2}):(\d{2})/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return minute === 0 ? `${hour12} ${suffix}` : `${hour12}:${match[2]} ${suffix}`;
}

function arrivalSummary(
  priority: string,
  arrivalStart: string,
  arrivalEnd: string,
  accessStart: string,
  accessEnd: string,
): string {
  const parts: string[] = [];
  if (priority === '1') parts.push('Flexible');
  else if (priority === '2') parts.push('Priority 2');
  else if (priority === '4') parts.push('Priority 4');
  else if (priority === '5') parts.push('First in line');
  if (arrivalStart && arrivalEnd) {
    parts.push(`Arrive ${clockLabel(arrivalStart)}–${clockLabel(arrivalEnd)}`);
  }
  if (accessStart && accessEnd) {
    parts.push(`Access ${clockLabel(accessStart)}–${clockLabel(accessEnd)}`);
  }
  return parts.join(' · ') || 'Standard priority';
}

function peopleSummary(preferred: string[], required: string[], blocked: string[]): string {
  const parts: string[] = [];
  if (preferred.length > 0) parts.push(`${preferred.length} preferred`);
  if (required.length > 0) parts.push(`${required.length} required`);
  if (blocked.length > 0) parts.push(`${blocked.length} blocked`);
  return parts.join(' · ') || 'Any available cleaner';
}

function requirementsSummary(input: {
  skills: string;
  certifications: string;
  equipment: string;
  languages: string;
  attributes: string;
  pet: boolean;
  sensitive: boolean;
  keyPickup: boolean;
}): string {
  const parts: string[] = [];
  if (input.skills.trim()) parts.push('Skills');
  if (input.certifications.trim()) parts.push('Certifications');
  if (input.equipment.trim()) parts.push('Equipment');
  if (input.languages.trim()) parts.push('Languages');
  if (input.attributes.trim()) parts.push('Who may enter');
  if (input.pet) parts.push('Pets');
  if (input.sensitive) parts.push('Fragrance-free');
  if (input.keyPickup) parts.push('Key pickup');
  return parts.join(' · ') || 'None added';
}

function toggleId(current: string[], id: string, checked: boolean): string[] {
  if (checked) return current.includes(id) ? current : [...current, id];
  return current.filter((item) => item !== id);
}

export function SchedulingPreferenceFields({
  facts,
  employees,
  idPrefix,
}: {
  facts: SchedulingFacts;
  employees: { id: string; label: string }[];
  idPrefix: string;
}) {
  const savedDays = facts.preferredWeekdays.join(',');
  const savedTime = facts.preferredTimeWindow ?? '';
  const savedPriority = String(facts.priority);
  const savedArrivalStart = timeInputValue(facts.arrivalWindow, 'start');
  const savedArrivalEnd = timeInputValue(facts.arrivalWindow, 'end');
  const savedAccessStart = timeInputValue(facts.accessWindow, 'start');
  const savedAccessEnd = timeInputValue(facts.accessWindow, 'end');
  const savedPreferred = facts.preferredUserIds.join(',');
  const savedRequired = facts.requiredUserIds.join(',');
  const savedBlocked = facts.blockedUserIds.join(',');
  const savedSkills = formatTagList(facts.requiredSkillTags);
  const savedCertifications = formatTagList(facts.requiredCertificationTags);
  const savedEquipment = formatTagList(facts.requiredEquipmentTags);
  const savedLanguages = formatTagList(facts.languageCodes);
  const savedAttributes = formatTagList(facts.requiredAttributeTags);

  const [days, setDays] = useState<WorkWeekDayKey[]>(facts.preferredWeekdays);
  const [timeOfDay, setTimeOfDay] = useState(savedTime);
  const [priority, setPriority] = useState(savedPriority);
  const [arrivalStart, setArrivalStart] = useState(savedArrivalStart);
  const [arrivalEnd, setArrivalEnd] = useState(savedArrivalEnd);
  const [accessStart, setAccessStart] = useState(savedAccessStart);
  const [accessEnd, setAccessEnd] = useState(savedAccessEnd);
  const [preferredIds, setPreferredIds] = useState(facts.preferredUserIds);
  const [requiredIds, setRequiredIds] = useState(facts.requiredUserIds);
  const [blockedIds, setBlockedIds] = useState(facts.blockedUserIds);
  const [skills, setSkills] = useState(savedSkills);
  const [certifications, setCertifications] = useState(savedCertifications);
  const [equipment, setEquipment] = useState(savedEquipment);
  const [languages, setLanguages] = useState(savedLanguages);
  const [attributes, setAttributes] = useState(savedAttributes);
  const [pet, setPet] = useState(facts.petInHome);
  const [sensitive, setSensitive] = useState(facts.chemicalSensitivity);
  const [keyPickup, setKeyPickup] = useState(facts.requiresKeyPickup);

  useEffect(() => {
    setDays(savedDays ? (savedDays.split(',') as WorkWeekDayKey[]) : []);
    setTimeOfDay(savedTime);
    setPriority(savedPriority);
    setArrivalStart(savedArrivalStart);
    setArrivalEnd(savedArrivalEnd);
    setAccessStart(savedAccessStart);
    setAccessEnd(savedAccessEnd);
    setPreferredIds(savedPreferred ? savedPreferred.split(',') : []);
    setRequiredIds(savedRequired ? savedRequired.split(',') : []);
    setBlockedIds(savedBlocked ? savedBlocked.split(',') : []);
    setSkills(savedSkills);
    setCertifications(savedCertifications);
    setEquipment(savedEquipment);
    setLanguages(savedLanguages);
    setAttributes(savedAttributes);
    setPet(facts.petInHome);
    setSensitive(facts.chemicalSensitivity);
    setKeyPickup(facts.requiresKeyPickup);
  }, [
    savedDays,
    savedTime,
    savedPriority,
    savedArrivalStart,
    savedArrivalEnd,
    savedAccessStart,
    savedAccessEnd,
    savedPreferred,
    savedRequired,
    savedBlocked,
    savedSkills,
    savedCertifications,
    savedEquipment,
    savedLanguages,
    savedAttributes,
    facts.petInHome,
    facts.chemicalSensitivity,
    facts.requiresKeyPickup,
  ]);

  function setDay(day: WorkWeekDayKey, checked: boolean) {
    setDays((current) =>
      checked
        ? WORK_WEEK_DAY_KEYS.filter((item) => item === day || current.includes(item))
        : current.filter((item) => item !== day),
    );
  }

  return (
    <div className={styles.fields}>
      <details className={styles.section} defaultOpen>
        <summary className={styles.sectionSummary}>
          <span className={styles.sectionTitle}>Days and time</span>
          <span className={styles.sectionHint}>{whenSummary(days, timeOfDay)}</span>
        </summary>
        <div className={styles.sectionBody}>
          <fieldset className={styles.block}>
            <legend className={styles.legend}>Days that work</legend>
            <div className={styles.dayList}>
              {WORK_WEEK_DAY_KEYS.map((day) => {
                const selected = days.includes(day);
                return (
                  <label
                    key={`${idPrefix}-day-${day}`}
                    className={styles.day}
                    data-selected={selected || undefined}
                  >
                    <input
                      type="checkbox"
                      name="preferred_weekday"
                      value={day}
                      checked={selected}
                      aria-label={DAY_NAME[day]}
                      onChange={(event) => setDay(day, event.target.checked)}
                    />
                    <span aria-hidden="true">{WORK_WEEK_DAY_LABEL[day]}</span>
                  </label>
                );
              })}
            </div>
            <p className={styles.note}>Leave every day off to use any day the business is open.</p>
          </fieldset>
          <fieldset className={styles.block}>
            <legend className={styles.legend}>Time of day</legend>
            <div className={styles.timeGrid}>
              {TIME_OPTIONS.map((option) => {
                const selected = timeOfDay === option.value;
                return (
                  <label
                    key={`${idPrefix}-time-${option.value || 'any'}`}
                    className={styles.timeCard}
                    data-selected={selected || undefined}
                  >
                    <input
                      type="radio"
                      name="preferred_time_window"
                      value={option.value}
                      checked={selected}
                      onChange={() => setTimeOfDay(option.value)}
                    />
                    <span className={styles.timeTitle}>{option.title}</span>
                    <span className={styles.timeHint}>{option.hint}</span>
                  </label>
                );
              })}
            </div>
            <p className={styles.note}>
              Fill schedule aims for this part of the day. An arrival window below replaces it.
            </p>
          </fieldset>
        </div>
      </details>

      <details className={styles.section}>
        <summary className={styles.sectionSummary}>
          <span className={styles.sectionTitle}>Arrival and access</span>
          <span className={styles.sectionHint}>
            {arrivalSummary(priority, arrivalStart, arrivalEnd, accessStart, accessEnd)}
          </span>
        </summary>
        <div className={styles.sectionBody}>
          <div className={styles.grid}>
            <label className={styles.field}>
              Priority
              <select
                name="priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="1">1 — Flexible</option>
                <option value="2">2</option>
                <option value="3">3 — Standard</option>
                <option value="4">4</option>
                <option value="5">5 — First in line</option>
              </select>
            </label>
            <label className={styles.field}>
              Arrival from
              <input
                type="time"
                name="arrival_start"
                value={arrivalStart}
                onChange={(event) => setArrivalStart(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Arrival until
              <input
                type="time"
                name="arrival_end"
                value={arrivalEnd}
                onChange={(event) => setArrivalEnd(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Site access from
              <input
                type="time"
                name="access_start"
                value={accessStart}
                onChange={(event) => setAccessStart(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Site access until
              <input
                type="time"
                name="access_end"
                value={accessEnd}
                onChange={(event) => setAccessEnd(event.target.value)}
              />
            </label>
          </div>
          <p className={styles.note}>
            Leave the arrival times blank to keep the time of day above.
          </p>
        </div>
      </details>

      <details className={styles.section}>
        <summary className={styles.sectionSummary}>
          <span className={styles.sectionTitle}>Cleaners</span>
          <span className={styles.sectionHint}>
            {peopleSummary(preferredIds, requiredIds, blockedIds)}
          </span>
        </summary>
        <div className={styles.sectionBody}>
          <PeoplePicker
            idPrefix={idPrefix}
            label="Preferred cleaners"
            name="preferred_user_id"
            employees={employees}
            selected={preferredIds}
            onToggle={(id, checked) => setPreferredIds((current) => toggleId(current, id, checked))}
          />
          <PeoplePicker
            idPrefix={idPrefix}
            label="Required cleaners"
            name="required_user_id"
            employees={employees}
            selected={requiredIds}
            onToggle={(id, checked) => setRequiredIds((current) => toggleId(current, id, checked))}
          />
          <PeoplePicker
            idPrefix={idPrefix}
            label="Blocked cleaners"
            name="blocked_user_id"
            employees={employees}
            selected={blockedIds}
            onToggle={(id, checked) => setBlockedIds((current) => toggleId(current, id, checked))}
          />
          <p className={styles.note}>
            Leave a list empty to skip that rule. It does not block the schedule.
          </p>
        </div>
      </details>

      <details className={styles.section}>
        <summary className={styles.sectionSummary}>
          <span className={styles.sectionTitle}>Skills and home</span>
          <span className={styles.sectionHint}>
            {requirementsSummary({
              skills,
              certifications,
              equipment,
              languages,
              attributes,
              pet,
              sensitive,
              keyPickup,
            })}
          </span>
        </summary>
        <div className={styles.sectionBody}>
          <div className={styles.grid}>
            <label className={styles.field}>
              Skills required
              <input
                name="required_skill_tags"
                value={skills}
                placeholder="floor-care, deep-clean"
                onChange={(event) => setSkills(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Certifications required
              <input
                name="required_certification_tags"
                value={certifications}
                placeholder="osha"
                onChange={(event) => setCertifications(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Equipment required
              <input
                name="required_equipment_tags"
                value={equipment}
                placeholder="floor-buffer"
                onChange={(event) => setEquipment(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Languages
              <input
                name="language_codes"
                value={languages}
                placeholder="spanish"
                onChange={(event) => setLanguages(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              Who may enter
              <input
                name="required_attribute_tags"
                value={attributes}
                placeholder="female, non-smoker"
                onChange={(event) => setAttributes(event.target.value)}
              />
            </label>
          </div>
          <div className={styles.checks}>
            <label className={styles.check} data-selected={pet || undefined}>
              <input
                type="checkbox"
                name="pet_in_home"
                checked={pet}
                onChange={(event) => setPet(event.target.checked)}
              />
              Pets in the home
            </label>
            <label className={styles.check} data-selected={sensitive || undefined}>
              <input
                type="checkbox"
                name="chemical_sensitivity"
                checked={sensitive}
                onChange={(event) => setSensitive(event.target.checked)}
              />
              Fragrance-free or sensitive clean
            </label>
            <label className={styles.check} data-selected={keyPickup || undefined}>
              <input
                type="checkbox"
                name="requires_key_pickup"
                checked={keyPickup}
                onChange={(event) => setKeyPickup(event.target.checked)}
              />
              Key or fob must be picked up at the office
            </label>
          </div>
        </div>
      </details>
    </div>
  );
}

function PeoplePicker({
  idPrefix,
  label,
  name,
  employees,
  selected,
  onToggle,
}: {
  idPrefix: string;
  label: string;
  name: string;
  employees: { id: string; label: string }[];
  selected: string[];
  onToggle: (id: string, checked: boolean) => void;
}) {
  const chosen = new Set(selected);
  return (
    <fieldset className={styles.block}>
      <legend className={styles.legend}>{label}</legend>
      {employees.length === 0 ? (
        <p className={styles.note}>No team members yet.</p>
      ) : (
        <div className={styles.personList}>
          {employees.map((employee) => {
            const isSelected = chosen.has(employee.id);
            return (
              <label
                key={`${idPrefix}-${name}-${employee.id}`}
                className={styles.person}
                data-selected={isSelected || undefined}
              >
                <input
                  type="checkbox"
                  name={name}
                  value={employee.id}
                  checked={isSelected}
                  onChange={(event) => onToggle(employee.id, event.target.checked)}
                />
                {employee.label}
              </label>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}
