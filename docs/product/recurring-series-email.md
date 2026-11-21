# Recurring series email

A customer gets **one** email when the office creates, changes, or cancels a repeating visit series. Visits the nightly job adds from that series are not emailed one by one.

## When it sends

- **Created** — Schedule → Recurring saves a new series.
- **Changed** — the office saves a new frequency, series time, or cleaner for upcoming visits. A save that does not change those three does not send.
- **Cancelled** — the office cancels an active series.

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

## What does not send

- The recurring materializer (`lib/schedule/recurringVisitMaterialize.ts`)
- Instant booking, which already sends one booking confirmation that names the repeat
- Skipping or deleting a single occurrence
- An office-created one-off visit

No new migration. The suppression list and the Resend idempotency key (`recurring-series-` plus a hash of the series) are the dedupe.
