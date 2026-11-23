# Recurring series email

A customer gets **one** email when the office creates, changes, or cancels a repeating visit series. Visits the nightly job adds from that series are not emailed one by one.

## When it sends

- **Created** — Schedule → Recurring saves a new series. A customer's instant booking that chooses weekly, every other week, or monthly sends this same created email once, after the series row exists. The booking confirmation still sends. Later occurrences are not emailed one by one. A one-time instant booking does not send the series email. A retry that finds the booking already confirmed does not send it again.
- **Changed** — the office saves a new frequency, series time, or cleaner for upcoming visits. A save that does not change those three does not send.
- **Cancelled** — the office cancels an active series.
- **One date** — the office deletes one visit that belongs to a series. The customer hears about that date only. The rest of the series stays. Moving that visit to another time does not send this note.

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

## What does not send

- The recurring materializer (`lib/schedule/recurringVisitMaterialize.ts`)
- One email per generated occurrence
- A second series email when instant booking is confirmed again
- Moving one occurrence to a new time
- Deleting a visit that is not part of a series

No new migration. The suppression list and the Resend idempotency key are the dedupe. Series create, change, and cancel use `recurring-series-` plus a hash of the series. One skipped date uses `series-occurrence-`. One office visit uses `office-visit-`.

Two overlapping saves of the same series (same customer, repeat rule, and anchor) inside two minutes insert one row. The row id is derived from that request and the two-minute window, so the primary key rejects the second insert. The second save does not send another email. A series that already committed in that window is reused the same way.
