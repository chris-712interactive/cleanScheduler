'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  formatSuggestionClock,
  type DaySchedulingGap,
  type DaySchedulingSuggestion,
} from '@/lib/schedule/optimizer/loadDay';
import { applyDaySuggestionAction, type ApplySuggestionState } from './suggestionActions';
import styles from './day-suggestions.module.scss';

const initial: ApplySuggestionState = {};

export function DaySchedulingSuggestions({
  tenantSlug,
  dateKey,
  timeZone,
  suggestions,
  gaps,
}: {
  tenantSlug: string;
  dateKey: string;
  timeZone: string;
  suggestions: DaySchedulingSuggestion[];
  gaps: DaySchedulingGap[];
}) {
  if (suggestions.length === 0 && gaps.length === 0) return null;

  return (
    <section className={styles.panel} aria-labelledby="day-suggestions-heading">
      <h2 id="day-suggestions-heading" className={styles.title}>
        Suggested crew
      </h2>
      <p className={styles.lead}>
        Open visits for this day, scored with your scheduling weights. Applying a suggestion sets
        the time and the crew. Visits that already have someone stay put.
      </p>
      <ul className={styles.list}>
        {suggestions.map((suggestion) => (
          <SuggestionRow
            key={suggestion.visitId}
            tenantSlug={tenantSlug}
            dateKey={dateKey}
            timeZone={timeZone}
            suggestion={suggestion}
          />
        ))}
        {gaps.map((gap) => (
          <li key={gap.visitId} className={styles.row}>
            <div>
              <p className={styles.visit}>
                {gap.customerName} · {gap.title}
              </p>
              <p className={styles.reasons}>{gap.reasons.join(' ') || 'No eligible opening.'}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SuggestionRow({
  tenantSlug,
  dateKey,
  timeZone,
  suggestion,
}: {
  tenantSlug: string;
  dateKey: string;
  timeZone: string;
  suggestion: DaySchedulingSuggestion;
}) {
  const [state, action, pending] = useActionState(applyDaySuggestionAction, initial);
  return (
    <li className={styles.row}>
      <div>
        <p className={styles.visit}>
          {suggestion.customerName} · {suggestion.title}
        </p>
        <p className={styles.assignment}>
          {suggestion.crewNames.join(', ')} · {formatSuggestionClock(suggestion.startMin)}–
          {formatSuggestionClock(suggestion.endMin)}
        </p>
        {suggestion.reasons.length > 0 ? (
          <p className={styles.reasons}>{suggestion.reasons.join(' · ')}</p>
        ) : null}
        {state.error ? <p className={styles.error}>{state.error}</p> : null}
        {state.success ? <p className={styles.success}>Applied.</p> : null}
      </div>
      <form action={action}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="visit_id" value={suggestion.visitId} />
        <input type="hidden" name="date_key" value={dateKey} />
        <input type="hidden" name="time_zone" value={timeZone} />
        <input type="hidden" name="start_min" value={suggestion.startMin} />
        <input type="hidden" name="end_min" value={suggestion.endMin} />
        {suggestion.userIds.map((userId) => (
          <input key={userId} type="hidden" name="user_id" value={userId} />
        ))}
        <Button type="submit" variant="secondary" size="sm" disabled={pending || state.success}>
          {pending ? 'Applying…' : 'Apply'}
        </Button>
      </form>
    </li>
  );
}
