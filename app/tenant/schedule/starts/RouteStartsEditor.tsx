'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  deleteRouteLocationAction,
  saveCleanerBaseAction,
  saveRouteLocationAction,
  updateRouteLocationAction,
  type RouteStartState,
} from './actions';
import styles from '../stop-order.module.scss';

const initial: RouteStartState = {};

export type RouteStartCleaner = {
  id: string;
  name: string;
  homeLine: string | null;
  defaultStart: string;
  defaultEnd: string;
  savedStartLabel: string;
  savedEndLabel: string;
  dayOverrides: Array<{ date: string; startLabel: string; endLabel: string }>;
};

export type RouteStartPlace = {
  id: string;
  label: string;
  located: boolean;
  addressLine: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
};

export function RouteStartsEditor({
  tenantSlug,
  places,
  cleaners,
}: {
  tenantSlug: string;
  places: RouteStartPlace[];
  cleaners: RouteStartCleaner[];
}) {
  const [locationState, saveLocation, locationPending] = useActionState(
    saveRouteLocationAction,
    initial,
  );
  const [baseState, saveCleaner, basePending] = useActionState(saveCleanerBaseAction, initial);
  const [deleteState, deletePlace, deletePending] = useActionState(
    deleteRouteLocationAction,
    initial,
  );
  const [updateState, updatePlace, updatePending] = useActionState(
    updateRouteLocationAction,
    initial,
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <>
      <section className={styles.panel} aria-labelledby="route-places-heading">
        <h2 id="route-places-heading" className={styles.title}>
          Places
        </h2>
        {places.length === 0 ? (
          <p className={styles.lead}>No extra places yet. The office is still the default start.</p>
        ) : (
          <ul className={styles.list} aria-label="Start locations">
            {places.map((place) => (
              <li key={place.id}>
                <p className={styles.meta}>{place.label}</p>
                <p className={styles.meta}>{place.addressLine}</p>
                {place.located ? null : <p className={styles.meta}>No map point yet</p>}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    setEditingId((current) => (current === place.id ? null : place.id))
                  }
                >
                  {editingId === place.id ? `Close ${place.label}` : `Edit ${place.label}`}
                </Button>
                {editingId === place.id ? (
                  <form action={updatePlace}>
                    <input type="hidden" name="tenant_slug" value={tenantSlug} />
                    <input type="hidden" name="location_id" value={place.id} />
                    <label className={styles.meta}>
                      Location name
                      <input
                        name="label"
                        required
                        maxLength={80}
                        aria-label={`Name for ${place.label}`}
                        defaultValue={place.label}
                      />
                    </label>
                    <label className={styles.meta}>
                      Street
                      <input
                        name="address_line1"
                        required
                        maxLength={200}
                        aria-label={`Street for ${place.label}`}
                        defaultValue={place.addressLine1}
                      />
                    </label>
                    <label className={styles.meta}>
                      City
                      <input
                        name="city"
                        aria-label={`City for ${place.label}`}
                        defaultValue={place.city}
                      />
                    </label>
                    <label className={styles.meta}>
                      State
                      <input
                        name="state"
                        aria-label={`State for ${place.label}`}
                        maxLength={2}
                        defaultValue={place.state}
                      />
                    </label>
                    <label className={styles.meta}>
                      Postal code
                      <input
                        name="postal_code"
                        aria-label={`Postal code for ${place.label}`}
                        defaultValue={place.postalCode}
                      />
                    </label>
                    {updateState.error ? <p className={styles.error}>{updateState.error}</p> : null}
                    {updateState.success ? (
                      <p className={styles.lead}>{updateState.success}</p>
                    ) : null}
                    <Button type="submit" variant="primary" disabled={updatePending}>
                      {updatePending ? 'Saving…' : `Save ${place.label}`}
                    </Button>
                  </form>
                ) : null}
                <form action={deletePlace}>
                  <input type="hidden" name="tenant_slug" value={tenantSlug} />
                  <input type="hidden" name="location_id" value={place.id} />
                  <Button type="submit" variant="secondary" disabled={deletePending}>
                    {deletePending ? 'Deleting…' : `Delete ${place.label}`}
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={saveLocation}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <label className={styles.meta}>
            Location name
            <input name="label" required maxLength={80} aria-label="Location name" />
          </label>
          <label className={styles.meta}>
            Street
            <input name="address_line1" required maxLength={200} aria-label="Street" />
          </label>
          <label className={styles.meta}>
            City
            <input name="city" aria-label="City" />
          </label>
          <label className={styles.meta}>
            State
            <input name="state" aria-label="State" maxLength={2} />
          </label>
          <label className={styles.meta}>
            Postal code
            <input name="postal_code" aria-label="Postal code" />
          </label>
          {locationState.error ? <p className={styles.error}>{locationState.error}</p> : null}
          {locationState.success ? <p className={styles.lead}>{locationState.success}</p> : null}
          {deleteState.error ? <p className={styles.error}>{deleteState.error}</p> : null}
          {deleteState.success ? <p className={styles.lead}>{deleteState.success}</p> : null}
          <Button type="submit" variant="primary" disabled={locationPending}>
            {locationPending ? 'Saving…' : 'Save start location'}
          </Button>
        </form>
      </section>

      <section className={styles.panel} aria-labelledby="route-bases-heading">
        <h2 id="route-bases-heading" className={styles.title}>
          Cleaner start and end
        </h2>
        <p className={styles.lead}>
          Leave the day blank to set the default. A day overrides the default for that date only.
          Home addresses on this page are for the office.
        </p>
        {cleaners.map((cleaner) => (
          <form key={cleaner.id} action={saveCleaner}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <input type="hidden" name="user_id" value={cleaner.id} />
            <h3 className={styles.cleanerHead}>{cleaner.name}</h3>
            {cleaner.homeLine ? (
              <p className={styles.meta}>Home: {cleaner.homeLine}</p>
            ) : (
              <p className={styles.meta}>No home address saved.</p>
            )}
            <label className={styles.meta}>
              Day
              <input type="date" name="service_date" aria-label={`Day for ${cleaner.name}`} />
            </label>
            <p className={styles.meta}>
              Saved default start for {cleaner.name}: {cleaner.savedStartLabel}
            </p>
            <p className={styles.meta}>
              Saved default end for {cleaner.name}: {cleaner.savedEndLabel}
            </p>
            {cleaner.dayOverrides.map((day) => (
              <p key={day.date} className={styles.meta}>
                Day {day.date} for {cleaner.name}: start {day.startLabel}, end {day.endLabel}
              </p>
            ))}
            <label className={styles.meta}>
              Start
              <select
                key={`${cleaner.id}-start-${cleaner.defaultStart}`}
                name="start_choice"
                aria-label={`Start for ${cleaner.name}`}
                defaultValue={cleaner.defaultStart}
              >
                <option value="office">Office</option>
                <option value="home" disabled={cleaner.homeLine == null}>
                  Home
                </option>
                {places.map((place) => (
                  <option key={place.id} value={`location:${place.id}`}>
                    {place.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.meta}>
              End
              <select
                key={`${cleaner.id}-end-${cleaner.defaultEnd}`}
                name="end_choice"
                aria-label={`End for ${cleaner.name}`}
                defaultValue={cleaner.defaultEnd}
              >
                <option value="none">No return</option>
                <option value="same">Same as start</option>
                <option value="office">Office</option>
                <option value="home" disabled={cleaner.homeLine == null}>
                  Home
                </option>
                {places.map((place) => (
                  <option key={place.id} value={`location:${place.id}`}>
                    {place.label}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" variant="secondary" disabled={basePending}>
              {basePending ? 'Saving…' : `Save start for ${cleaner.name}`}
            </Button>
          </form>
        ))}
        {baseState.error ? <p className={styles.error}>{baseState.error}</p> : null}
        {baseState.success ? <p className={styles.lead}>{baseState.success}</p> : null}
      </section>
    </>
  );
}
