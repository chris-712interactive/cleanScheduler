import {
  formatTagList,
  timeInputValue,
  type SchedulingFacts,
} from '@/lib/schedule/optimizer/preferences';
import styles from './scheduling-fields.module.scss';

export function SchedulingPreferenceFields({
  facts,
  employees,
  idPrefix,
}: {
  facts: SchedulingFacts;
  employees: { id: string; label: string }[];
  idPrefix: string;
}) {
  return (
    <div className={styles.fields}>
      <div className={styles.grid}>
        <label className={styles.field}>
          Priority
          <select name="priority" defaultValue={String(facts.priority)}>
            <option value="1">1 — Flexible</option>
            <option value="2">2</option>
            <option value="3">3 — Standard</option>
            <option value="4">4</option>
            <option value="5">5 — First in line</option>
          </select>
        </label>
        <label className={styles.field}>
          Crew size
          <input
            type="number"
            name="required_crew_size"
            min={1}
            max={8}
            defaultValue={facts.requiredCrewSize}
          />
        </label>
        <label className={styles.field}>
          Arrival from
          <input
            type="time"
            name="arrival_start"
            defaultValue={timeInputValue(facts.arrivalWindow, 'start')}
          />
        </label>
        <label className={styles.field}>
          Arrival until
          <input
            type="time"
            name="arrival_end"
            defaultValue={timeInputValue(facts.arrivalWindow, 'end')}
          />
        </label>
        <label className={styles.field}>
          Site access from
          <input
            type="time"
            name="access_start"
            defaultValue={timeInputValue(facts.accessWindow, 'start')}
          />
        </label>
        <label className={styles.field}>
          Site access until
          <input
            type="time"
            name="access_end"
            defaultValue={timeInputValue(facts.accessWindow, 'end')}
          />
        </label>
      </div>

      <PeoplePicker
        idPrefix={idPrefix}
        label="Preferred cleaners"
        name="preferred_user_id"
        employees={employees}
        selected={facts.preferredUserIds}
      />
      <PeoplePicker
        idPrefix={idPrefix}
        label="Required cleaners"
        name="required_user_id"
        employees={employees}
        selected={facts.requiredUserIds}
      />
      <PeoplePicker
        idPrefix={idPrefix}
        label="Blocked cleaners"
        name="blocked_user_id"
        employees={employees}
        selected={facts.blockedUserIds}
      />

      <div className={styles.grid}>
        <label className={styles.field}>
          Skills required
          <input
            name="required_skill_tags"
            defaultValue={formatTagList(facts.requiredSkillTags)}
            placeholder="floor-care, deep-clean"
          />
        </label>
        <label className={styles.field}>
          Certifications required
          <input
            name="required_certification_tags"
            defaultValue={formatTagList(facts.requiredCertificationTags)}
            placeholder="osha"
          />
        </label>
        <label className={styles.field}>
          Equipment required
          <input
            name="required_equipment_tags"
            defaultValue={formatTagList(facts.requiredEquipmentTags)}
            placeholder="floor-buffer"
          />
        </label>
        <label className={styles.field}>
          Languages
          <input
            name="language_codes"
            defaultValue={formatTagList(facts.languageCodes)}
            placeholder="spanish"
          />
        </label>
        <label className={styles.field}>
          Who may enter
          <input
            name="required_attribute_tags"
            defaultValue={formatTagList(facts.requiredAttributeTags)}
            placeholder="female, non-smoker"
          />
        </label>
      </div>

      <div className={styles.checks}>
        <label>
          <input type="checkbox" name="pet_in_home" defaultChecked={facts.petInHome} /> Pets in the
          home
        </label>
        <label>
          <input
            type="checkbox"
            name="chemical_sensitivity"
            defaultChecked={facts.chemicalSensitivity}
          />{' '}
          Fragrance-free or sensitive clean
        </label>
        <label>
          <input
            type="checkbox"
            name="requires_key_pickup"
            defaultChecked={facts.requiresKeyPickup}
          />{' '}
          Key or fob must be picked up at the office
        </label>
      </div>
    </div>
  );
}

function PeoplePicker({
  idPrefix,
  label,
  name,
  employees,
  selected,
}: {
  idPrefix: string;
  label: string;
  name: string;
  employees: { id: string; label: string }[];
  selected: string[];
}) {
  const chosen = new Set(selected);
  return (
    <fieldset className={styles.people}>
      <legend>{label}</legend>
      {employees.length === 0 ? (
        <p className={styles.empty}>No team members yet.</p>
      ) : (
        <div className={styles.peopleGrid}>
          {employees.map((employee) => (
            <label key={`${idPrefix}-${name}-${employee.id}`}>
              <input
                type="checkbox"
                name={name}
                value={employee.id}
                defaultChecked={chosen.has(employee.id)}
              />
              {employee.label}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
