import styles from './quotes.module.scss';

export function QuoteCrewSizeField({
  id,
  value,
  defaultValue,
  onChange,
}: {
  id: string;
  value?: string;
  defaultValue?: number;
  onChange?: (value: string) => void;
}) {
  const controlled = value !== undefined;
  return (
    <>
      <label className={styles.label} htmlFor={id}>
        Crew size
      </label>
      <input
        id={id}
        name="required_crew_size"
        className={styles.input}
        type="number"
        min={1}
        max={8}
        step={1}
        inputMode="numeric"
        {...(controlled
          ? { value, onChange: (event) => onChange?.(event.target.value) }
          : { defaultValue: defaultValue ?? 1 })}
      />
      <p className={styles.hint}>
        How many cleaners this location needs. The price is still the amount you enter. Saving
        stores this on the quote and on the service location so the schedule can assign that many
        people.
      </p>
    </>
  );
}
