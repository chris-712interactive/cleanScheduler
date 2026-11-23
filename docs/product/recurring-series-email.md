# Recurring series email

A customer gets **one** email when the office creates, changes, or cancels a repeating visit series. Visits the nightly job adds from that series are not emailed one by one.

## When it sends

- **Created** — Schedule → Recurring saves a new series. A customer's instant booking that chooses weekly, every other week, or monthly sends this same created email once, after the series row exists. The booking confirmation still sends. Later occurrences are not emailed one by one. A one-time instant booking does not send the series email. A retry that finds the booking already confirmed does not send it again.
- **Changed** — the office saves a new frequency, series time, or cleaner for upcoming visits. A save that does not change those three does not send.
- **Cancelled** — the office cancels an active series.
- **One date** — the office deletes one visit that belongs to a series. The customer hears about that date only. The note names the full visit window in the workspace timezone (start and end, and the end date when the visit crosses midnight). The rest of the series stays. Moving that visit to another time sends a different note for that date only: the previous time and the new time. It does not cancel the series and it does not send the series-changed email.
- **This visit only** — from the visit on the schedule, Save time, Save crew, Save job details, or Save job price asks whether the change is for this visit only. That choice changes only that visit. A time change still sends the one-date move note.
- **This and future visits** — the same prompt’s other choice. The office series ends before that visit. A new series starts at the edited visit. The customer gets one series-updated email, not one email per visit. The series time in that email is the full window in the workspace timezone. Completed visits, checked-in visits, and visits that already have an invoice stay as they are, including their payments. A future visit that was already moved keeps its time. Crew, notes, and price from that save still apply to those moved visits. Moving a monthly visit to the 29th, 30th, or 31st keeps later visits in their own months; February and 30-day months use the last day of that month instead of spilling into the next one. Visits the nightly job has not created yet follow the new series the same way. Notes on those later visits stay the generated series note, and crew is still assigned only to visits already on the calendar. If the save fails partway through, the new series is removed and the visits stay on the original series.

The message is from the cleaning company (logo, color, address, reply-to). See `docs/product/email-branding.md`.

The body names the service, how often it repeats, the series time in the workspace timezone, and the cleaner when one is already on an upcoming visit. A change lists frequency, time, and cleaner only for what actually changed.

**View your visits** opens the customer portal visits page.

## Who is emailed

The customer identity email on that workspace. Marketing opt-in is not required.

No email when:

- the customer has no email
- that address is on the workspace suppression list (`tenant_email_suppressions`: unsubscribe, bounce, complaint, or manual)
- Resend is not configured
- `OUTBOUND_SUPPRESSED=1` (the send is logged and Resend is not called)

## What a cleaner change does

Choosing a cleaner updates every future scheduled visit on that series that has not been checked in. Visits that are not on the calendar yet are left alone, and the page says so. Those crew changes also use the existing cleaner schedule email, one note per cleaner, not one note per visit.

## One office visit

Schedule → New visit emails the customer when the office saves a single scheduled visit that is not part of a series. The message is from the cleaning company and names the service, the time, and the cleaner when one was assigned. **View your visits** opens the customer portal visits page. A visit saved as cancelled, a failed save, and a visit that belongs to a series do not send this note. The same skip rules apply: no customer email, a suppression row, Resend not configured, or `OUTBOUND_SUPPRESSED=1`.

Schedule → the visit → Save time emails that customer when the start or end changes. The message names the previous time and the new time. Saving the same window does not send. Owners and admins can save that time. A field employee is stopped before anything is written.

Deleting that visit emails the customer that it is cancelled. A visit that belongs to a series uses the one-date notes above instead. Delete stays limited to owners and admins, and that check runs before the delete or the email.

## What does not send

- The recurring materializer (`lib/schedule/recurringVisitMaterialize.ts`)
- One email per generated occurrence
- A second series email when instant booking is confirmed again
- A time save that does not change the start or the end
- A series-changed email when only one occurrence moves
- A second email when the office approves a customer reschedule request (that decision already has its own note). The approval names the new window in the workspace timezone, and the previous window when that time is still known. A decline does not include a new time.

No new migration. The suppression list and the Resend idempotency key are the dedupe. Series create, change, and cancel use `recurring-series-` plus a hash of the series. One skipped date uses `series-occurrence-`. One moved occurrence uses `series-occurrence-move-`. One office visit uses `office-visit-`. A time change on that visit uses `office-visit-time-`. Deleting it uses `office-visit-cancel-`. The time-change and move keys include the previous and next window, so the same save cannot send twice and a later, different time can send again.

Two overlapping saves of the same series (same customer, repeat rule, and anchor) inside two minutes insert one row. The row id is derived from that request and the two-minute window, so the primary key rejects the second insert. The second save does not send another email. A series that already committed in that window is reused the same way.
