'use client';

import { useActionState, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { updatePublicBookingRequestSettings, type BookingRequestSettingsState } from './actions';
import ops from '../operations/operations-settings.module.scss';
import styles from './booking-settings.module.scss';

const initial: BookingRequestSettingsState = {};

type ZoneRow = { id: string; name: string; postalCodes: string };

export function BookingRequestSettingsForm({
  tenantSlug,
  mode,
  publicUrl,
  readOnly = false,
  leadTimeHours,
  windowDays,
  bufferMinutes,
  slotStepMinutes,
  depositDollars,
  collectCard,
  allowRecurring,
  allowWeekly,
  allowBiweekly,
  allowMonthly,
  travelMph,
  zones,
}: {
  tenantSlug: string;
  mode: 'off' | 'request' | 'instant';
  publicUrl: string;
  readOnly?: boolean;
  leadTimeHours: number;
  windowDays: number;
  bufferMinutes: number;
  slotStepMinutes: number;
  depositDollars: string;
  collectCard: boolean;
  allowRecurring: boolean;
  allowWeekly: boolean;
  allowBiweekly: boolean;
  allowMonthly: boolean;
  travelMph: number;
  zones: ZoneRow[];
}) {
  const [state, formAction, pending] = useActionState(updatePublicBookingRequestSettings, initial);
  const [selectedMode, setSelectedMode] = useState(mode);
  useFeedbackToast({ error: state.error, success: state.success, pending });
  const disabled = readOnly || pending;

  return (
    <form action={formAction} className={ops.opsStack}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />

      <fieldset className={styles.modes} disabled={disabled}>
        <legend className={ops.sectionTitle}>Booking mode</legend>
        <p className={ops.sectionLead}>
          Off hides the public page. Request only keeps the quote form. Instant booking lets a
          customer pick an open time and creates the visit.
        </p>
        <label className={styles.mode}>
          <input
            type="radio"
            name="public_booking_mode"
            value="off"
            checked={selectedMode === 'off'}
            onChange={() => setSelectedMode('off')}
          />
          <span>
            <strong>Off</strong>
            <span>Visitors see that online booking is unavailable. Booking links stay hidden.</span>
          </span>
        </label>
        <label className={styles.mode}>
          <input
            type="radio"
            name="public_booking_mode"
            value="request"
            checked={selectedMode === 'request'}
            onChange={() => setSelectedMode('request')}
          />
          <span>
            <strong>Request only</strong>
            <span>The current quote form. Nothing is placed on the calendar.</span>
          </span>
        </label>
        <label className={styles.mode}>
          <input
            type="radio"
            name="public_booking_mode"
            value="instant"
            checked={selectedMode === 'instant'}
            onChange={() => setSelectedMode('instant')}
          />
          <span>
            <strong>Instant booking</strong>
            <span>
              Customers book a real visit from crew availability. Save this mode, then add the
              services they can book.
            </span>
          </span>
        </label>
      </fieldset>

      {selectedMode !== 'off' ? (
        <p className={ops.technicalNote}>
          <a href={publicUrl} target="_blank" rel="noopener noreferrer">
            {publicUrl}
          </a>
        </p>
      ) : (
        <p className={ops.sectionLead}>The public link is hidden while booking is off.</p>
      )}

      <div className={styles.grid} hidden={selectedMode !== 'instant'}>
        <label className={styles.field}>
          Lead time (hours)
          <input
            name="instant_booking_lead_time_hours"
            type="number"
            min={0}
            max={168}
            defaultValue={leadTimeHours}
            disabled={disabled}
          />
        </label>
        <label className={styles.field}>
          Booking window (days)
          <input
            name="instant_booking_window_days"
            type="number"
            min={1}
            max={90}
            defaultValue={windowDays}
            disabled={disabled}
          />
        </label>
        <label className={styles.field}>
          Buffer between jobs (minutes)
          <input
            name="instant_booking_buffer_minutes"
            type="number"
            min={0}
            max={240}
            defaultValue={bufferMinutes}
            disabled={disabled}
          />
        </label>
        <label className={styles.field}>
          Slot step
          <select
            name="instant_booking_slot_step_minutes"
            defaultValue={String(slotStepMinutes)}
            disabled={disabled}
          >
            <option value="15">15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">60 minutes</option>
          </select>
        </label>
        <label className={styles.field}>
          Deposit (dollars, 0 for none)
          <input
            name="instant_booking_deposit_dollars"
            inputMode="decimal"
            defaultValue={depositDollars}
            disabled={disabled}
          />
        </label>
        <label className={styles.field}>
          Travel speed (mph)
          <input
            name="instant_booking_travel_mph"
            type="number"
            min={5}
            max={80}
            defaultValue={travelMph}
            disabled={disabled}
          />
        </label>
        <label className={ops.notifyToggle}>
          <input
            type="checkbox"
            name="instant_booking_collect_card"
            defaultChecked={collectCard}
            disabled={disabled}
          />
          Save a card when no deposit is charged
        </label>
        <label className={ops.notifyToggle}>
          <input
            type="checkbox"
            name="instant_booking_allow_recurring"
            defaultChecked={allowRecurring}
            disabled={disabled}
          />
          Allow repeating visits
        </label>
        <label className={ops.notifyToggle}>
          <input
            type="checkbox"
            name="instant_booking_allow_weekly"
            defaultChecked={allowWeekly}
            disabled={disabled}
          />
          Weekly
        </label>
        <label className={ops.notifyToggle}>
          <input
            type="checkbox"
            name="instant_booking_allow_biweekly"
            defaultChecked={allowBiweekly}
            disabled={disabled}
          />
          Every two weeks
        </label>
        <label className={ops.notifyToggle}>
          <input
            type="checkbox"
            name="instant_booking_allow_monthly"
            defaultChecked={allowMonthly}
            disabled={disabled}
          />
          Monthly
        </label>
        {zones.length > 0 ? (
          <div className={styles.zones}>
            <h3 className={ops.sectionTitle}>Service area ZIP codes</h3>
            <p className={ops.sectionLead}>
              Leave a zone blank to ignore it. When any zone has ZIP codes, addresses outside those
              ZIPs cannot book.
            </p>
            {zones.map((zone) => (
              <label key={zone.id} className={styles.field}>
                {zone.name}
                <input
                  name={`zone_postal_${zone.id}`}
                  defaultValue={zone.postalCodes}
                  placeholder="33982, 33950"
                  disabled={disabled}
                />
              </label>
            ))}
          </div>
        ) : null}
      </div>

      {!readOnly ? (
        <div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? 'Saving…' : 'Save booking settings'}
          </Button>
        </div>
      ) : null}
    </form>
  );
}
