'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { googleMapsLegUrl } from '@/lib/mileage/mapsLink';
import {
  countedMiles,
  formatRateDollars,
  listedMiles,
  odometerSummary,
  reimbursementCents,
  type MileageDayStatus,
  type MileageLegDraft,
  type MileageSettings,
  type MileageVehicle,
} from '@/lib/mileage/model';
import type { MileagePlaceOption } from '@/lib/mileage/store';
import { saveMileageDayAction, type MileageActionState } from './mileageActions';
import styles from './mileage.module.scss';

const initial: MileageActionState = {};

const KIND_LABEL: Record<string, string> = {
  home: 'Home',
  visit: 'Job',
  event: 'Event',
  supply: 'Supply',
  estimate: 'Estimate',
  office: 'Office',
  other: 'Other',
};

function money(cents: number | null): string {
  if (cents == null) return 'Off';
  return `$${(cents / 100).toFixed(2)}`;
}

export function MileageDayForm({
  tenantSlug,
  userId,
  workDate,
  personName,
  status,
  vehicle,
  odometerStart,
  odometerEnd,
  legs,
  places,
  settings,
  locked,
  timeZone,
}: {
  tenantSlug: string;
  userId: string;
  workDate: string;
  personName: string;
  status: MileageDayStatus;
  vehicle: MileageVehicle;
  odometerStart: number | null;
  odometerEnd: number | null;
  legs: MileageLegDraft[];
  places: MileagePlaceOption[];
  settings: MileageSettings;
  locked: boolean;
  timeZone: string;
}) {
  const [state, formAction, pending] = useActionState(saveMileageDayAction, initial);
  useFeedbackToast({ error: state.error, success: state.success, pending });
  const counted = countedMiles(legs);
  const listed = listedMiles(legs);
  const amount = reimbursementCents({ settings, vehicle, counted });
  const odometer = odometerSummary(odometerStart, odometerEnd, listed);

  return (
    <form action={formAction} className={styles.stack}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="work_date" value={workDate} />
      <input type="hidden" name="time_zone" value={timeZone} />
      <input type="hidden" name="leg_count" value={legs.length} />

      <div className={styles.summary}>
        <p className={styles.miles}>{counted.toFixed(1)} mi</p>
        <p className={styles.meta}>
          {personName} · {workDate} · {status}
          {settings.reimbursementEnabled
            ? ` · ${vehicle === 'company' ? 'Company van · $0.00' : money(amount)}`
            : ' · Miles only'}
        </p>
        {settings.reimbursementEnabled && settings.rateCentsPerMile != null ? (
          <p className={styles.meta}>
            Rate {formatRateDollars(settings.rateCentsPerMile)} per mile
          </p>
        ) : null}
        {legs.some((leg) => leg.source === 'suggested') ? (
          <p className={styles.meta}>
            Road miles{' '}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
            >
              © OpenStreetMap contributors
            </a>
          </p>
        ) : null}
      </div>

      {legs.length === 0 ? (
        <p className={styles.lead}>
          Nothing is on this day yet. Add a job from the schedule, or add a stop for an event or
          errand.
        </p>
      ) : (
        legs.map((leg, index) => {
          const prefix = `leg_${index}_`;
          const mapsHref = googleMapsLegUrl(
            leg.originAddress || leg.originLabel,
            leg.destAddress || leg.destLabel,
          );
          return (
            <div key={`${leg.originLabel}-${leg.destLabel}-${index}`} className={styles.leg}>
              <div>
                <p className={styles.legTitle}>
                  {leg.originLabel} → {leg.destLabel}
                </p>
                <p className={styles.meta}>
                  {KIND_LABEL[leg.destKind] ?? leg.destKind} · {leg.source}
                  {leg.included ? '' : ' · left off'}
                  {leg.source === 'suggested' ? ' · suggested road miles' : ''}
                </p>
                {leg.checkInAway ? (
                  <p className={`${styles.meta} ${styles.away}`}>
                    Check-in was away from this stop. The stop stays at the job address.
                  </p>
                ) : null}
                <p className={styles.meta}>
                  <a href={mapsHref} target="_blank" rel="noopener noreferrer">
                    Open in Maps
                  </a>
                </p>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    name={`${prefix}included`}
                    defaultChecked={leg.included}
                    disabled={locked || pending}
                  />
                  Count this drive
                </label>
              </div>
              <label className={styles.field}>
                <span className={styles.label}>Miles</span>
                <input
                  className={styles.milesInput}
                  name={`${prefix}miles`}
                  inputMode="decimal"
                  defaultValue={leg.miles ?? ''}
                  aria-label={`Miles from ${leg.originLabel} to ${leg.destLabel}`}
                  disabled={locked || pending}
                />
              </label>
              <input type="hidden" name={`${prefix}original_miles`} value={leg.miles ?? ''} />
              <input type="hidden" name={`${prefix}source`} value={leg.source} />
              <input type="hidden" name={`${prefix}origin_label`} value={leg.originLabel} />
              <input type="hidden" name={`${prefix}origin_address`} value={leg.originAddress} />
              <input type="hidden" name={`${prefix}origin_kind`} value={leg.originKind} />
              <input type="hidden" name={`${prefix}origin_lat`} value={leg.originLat ?? ''} />
              <input type="hidden" name={`${prefix}origin_lng`} value={leg.originLng ?? ''} />
              <input type="hidden" name={`${prefix}dest_label`} value={leg.destLabel} />
              <input type="hidden" name={`${prefix}dest_address`} value={leg.destAddress} />
              <input type="hidden" name={`${prefix}dest_kind`} value={leg.destKind} />
              <input type="hidden" name={`${prefix}dest_lat`} value={leg.destLat ?? ''} />
              <input type="hidden" name={`${prefix}dest_lng`} value={leg.destLng ?? ''} />
              <input type="hidden" name={`${prefix}visit_id`} value={leg.visitId ?? ''} />
              <input
                type="hidden"
                name={`${prefix}check_in_away`}
                value={leg.checkInAway ? '1' : '0'}
              />
            </div>
          );
        })
      )}

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>Vehicle</span>
          <select
            className={styles.select}
            name="vehicle"
            defaultValue={vehicle}
            disabled={locked || pending}
          >
            <option value="personal">My car</option>
            <option value="company">Company van</option>
          </select>
        </label>
      </div>

      {settings.askOdometer ? (
        <div className={styles.stack}>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Odometer start</span>
              <input
                className={styles.input}
                name="odometer_start"
                inputMode="decimal"
                defaultValue={odometerStart ?? ''}
                disabled={locked || pending}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Odometer end</span>
              <input
                className={styles.input}
                name="odometer_end"
                inputMode="decimal"
                defaultValue={odometerEnd ?? ''}
                disabled={locked || pending}
              />
            </label>
          </div>
          {odometer.driven != null ? (
            <p className={styles.meta}>
              {odometer.gap === 0
                ? `Odometer ${odometer.driven.toFixed(1)} mi matches the trips.`
                : `Odometer ${odometer.driven.toFixed(1)} mi. Trips on this list ${listed.toFixed(1)} mi. About ${Math.abs(odometer.gap ?? 0).toFixed(1)} mi are not on a stop yet.`}
            </p>
          ) : (
            <p className={styles.meta}>
              Start and end are optional. The day can be confirmed from the trips alone.
            </p>
          )}
        </div>
      ) : null}

      {locked ? (
        <p className={styles.lead}>This day is approved. The office has the record.</p>
      ) : (
        <div className={styles.actions}>
          <Button type="submit" name="intent" value="confirm" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Looks right'}
          </Button>
          <Button type="submit" name="intent" value="save" variant="secondary" disabled={pending}>
            Save draft
          </Button>
          <Button
            type="submit"
            name="intent"
            value="rebuild"
            variant="secondary"
            disabled={pending}
          >
            Rebuild from schedule
          </Button>
        </div>
      )}

      {!locked ? (
        <fieldset className={styles.stack}>
          <legend className={styles.label}>Add a stop</legend>
          <div className={styles.row}>
            <label className={styles.field}>
              <span className={styles.label}>Name</span>
              <input className={styles.input} name="stop_label" placeholder="Chamber breakfast" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Address</span>
              <input className={styles.input} name="stop_address" placeholder="100 Main St, City" />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Kind</span>
              <select className={styles.select} name="stop_kind" defaultValue="event">
                <option value="event">Event</option>
                <option value="supply">Supply</option>
                <option value="estimate">Estimate</option>
                <option value="office">Office</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>
          <label className={styles.check}>
            <input type="checkbox" name="save_place" />
            Save this place for next time
          </label>
          <div className={styles.actions}>
            <Button
              type="submit"
              name="intent"
              value="add_stop"
              variant="secondary"
              disabled={pending}
            >
              Add stop
            </Button>
          </div>
          {places.length > 0 ? (
            <div className={styles.row}>
              <label className={styles.field}>
                <span className={styles.label}>Saved place</span>
                <select className={styles.select} name="place_id" defaultValue={places[0]?.id}>
                  {places.map((place) => (
                    <option key={place.id} value={place.id}>
                      {place.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="submit"
                name="intent"
                value="add_place_stop"
                variant="secondary"
                disabled={pending}
              >
                Add saved place
              </Button>
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </form>
  );
}
