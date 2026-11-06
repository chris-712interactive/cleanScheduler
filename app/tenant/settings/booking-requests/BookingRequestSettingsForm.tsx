'use client';

import { useActionState, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
import { updatePublicBookingRequestSettings, type BookingRequestSettingsState } from './actions';
import styles from './booking-settings.module.scss';

const initial: BookingRequestSettingsState = {};

type ZoneRow = { id: string; name: string; postalCodes: string };
type BookingMode = 'off' | 'request' | 'instant';

const MODES: { value: BookingMode; title: string; hint: string }[] = [
  {
    value: 'off',
    title: 'Off',
    hint: 'The public page and booking links stay hidden.',
  },
  {
    value: 'request',
    title: 'Request only',
    hint: 'Visitors send a quote request. Nothing is placed on the calendar.',
  },
  {
    value: 'instant',
    title: 'Instant booking',
    hint: 'Visitors pick an open time and the visit is created.',
  },
];

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
  children,
}: {
  tenantSlug: string;
  mode: BookingMode;
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
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(updatePublicBookingRequestSettings, initial);
  const [selectedMode, setSelectedMode] = useState<BookingMode>(mode);
  useFeedbackToast({ error: state.error, success: state.success, pending });
  const disabled = readOnly || pending;
  const instant = selectedMode === 'instant';

  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Booking sections">
        <a className={styles.navLink} href="#booking-mode">
          Mode
        </a>
        {instant ? (
          <>
            <a className={styles.navLink} href="#booking-when">
              Availability
            </a>
            <a className={styles.navLink} href="#booking-pay">
              Payment
            </a>
            <a className={styles.navLink} href="#booking-repeat">
              Repeats
            </a>
            {zones.length > 0 ? (
              <a className={styles.navLink} href="#booking-areas">
                Areas
              </a>
            ) : null}
          </>
        ) : null}
        {mode === 'instant' ? (
          <a className={styles.navLink} href="#booking-services">
            Services
          </a>
        ) : null}
      </nav>

      <div className={styles.main}>
        <form action={formAction} className={styles.main}>
          <section id="booking-mode" className={styles.section}>
            <input type="hidden" name="tenant_slug" value={tenantSlug} />
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>Booking mode</h2>
              <p className={styles.sectionLead}>
                Pick how the public page behaves. Instant booking uses the sections below, and the
                services list after you save.
              </p>
            </div>
            <fieldset className={styles.modeFieldset} disabled={disabled}>
              <legend className={styles.visuallyHidden}>Booking mode</legend>
              <div className={styles.modeGrid}>
                {MODES.map((option) => (
                  <label key={option.value} className={styles.modeCard}>
                    <input
                      type="radio"
                      name="public_booking_mode"
                      value={option.value}
                      checked={selectedMode === option.value}
                      onChange={() => setSelectedMode(option.value)}
                    />
                    <span>
                      <span className={styles.modeTitle}>{option.title}</span>
                      <span className={styles.modeHint}>{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            {selectedMode === 'off' ? (
              <p className={styles.sectionLead}>
                The public link stays hidden while booking is off.
              </p>
            ) : (
              <p className={styles.linkBar}>
                <span className={styles.linkLabel}>Public page</span>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  {publicUrl}
                </a>
              </p>
            )}
          </section>

          <div className={styles.main} hidden={!instant}>
            <section id="booking-when" className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Availability</h2>
                <p className={styles.sectionLead}>
                  How far ahead a customer can book, and how the open times are spaced.
                </p>
              </div>
              <div className={styles.fieldGrid}>
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
                  <span className={styles.hint}>Earliest a new booking can start.</span>
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
                  <span className={styles.hint}>How far into the calendar they can look.</span>
                </label>
                <label className={styles.field}>
                  Buffer (minutes)
                  <input
                    name="instant_booking_buffer_minutes"
                    type="number"
                    min={0}
                    max={240}
                    defaultValue={bufferMinutes}
                    disabled={disabled}
                  />
                  <span className={styles.hint}>Gap left between jobs.</span>
                </label>
                <label className={styles.field}>
                  Slot step
                  <select
                    name="instant_booking_slot_step_minutes"
                    defaultValue={String(slotStepMinutes)}
                    disabled={disabled}
                  >
                    <option value="15">Every 15 minutes</option>
                    <option value="30">Every 30 minutes</option>
                    <option value="60">Every hour</option>
                  </select>
                  <span className={styles.hint}>Start times offered on the page.</span>
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
                  <span className={styles.hint}>
                    Used to see if the crew can reach the address.
                  </span>
                </label>
              </div>
            </section>

            <section id="booking-pay" className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Payment</h2>
                <p className={styles.sectionLead}>
                  A deposit is collected at booking. Leave it at 0 to skip the charge.
                </p>
              </div>
              <div className={styles.fieldGrid}>
                <label className={styles.field}>
                  Deposit (dollars)
                  <input
                    name="instant_booking_deposit_dollars"
                    inputMode="decimal"
                    defaultValue={depositDollars}
                    disabled={disabled}
                  />
                </label>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    name="instant_booking_collect_card"
                    defaultChecked={collectCard}
                    disabled={disabled}
                  />
                  Save a card when no deposit is charged
                </label>
              </div>
            </section>

            <section id="booking-repeat" className={styles.section}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Repeats</h2>
                <p className={styles.sectionLead}>
                  Which repeating schedules a customer can choose with the first visit.
                </p>
              </div>
              <div className={styles.toggleGrid}>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    name="instant_booking_allow_recurring"
                    defaultChecked={allowRecurring}
                    disabled={disabled}
                  />
                  Allow repeating visits
                </label>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    name="instant_booking_allow_weekly"
                    defaultChecked={allowWeekly}
                    disabled={disabled}
                  />
                  Weekly
                </label>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    name="instant_booking_allow_biweekly"
                    defaultChecked={allowBiweekly}
                    disabled={disabled}
                  />
                  Every two weeks
                </label>
                <label className={styles.toggle}>
                  <input
                    type="checkbox"
                    name="instant_booking_allow_monthly"
                    defaultChecked={allowMonthly}
                    disabled={disabled}
                  />
                  Monthly
                </label>
              </div>
            </section>

            {zones.length > 0 ? (
              <section id="booking-areas" className={styles.section}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Service areas</h2>
                  <p className={styles.sectionLead}>
                    Leave a zone blank to ignore it. When any zone lists ZIP codes, addresses
                    outside those ZIPs cannot book.
                  </p>
                </div>
                <div className={styles.zoneList}>
                  {zones.map((zone) => (
                    <label key={zone.id} className={styles.zoneRow}>
                      <span className={styles.zoneName}>{zone.name}</span>
                      <input
                        name={`zone_postal_${zone.id}`}
                        defaultValue={zone.postalCodes}
                        placeholder="33982, 33950"
                        disabled={disabled}
                        aria-label={`${zone.name} ZIP codes`}
                      />
                    </label>
                  ))}
                </div>
              </section>
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
        {children}
      </div>
    </div>
  );
}
