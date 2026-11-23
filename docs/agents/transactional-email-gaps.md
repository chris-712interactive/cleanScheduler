# Transactional email gaps after series and time-off mail

Product copy is `docs/product/recurring-series-email.md` and `docs/product/time-off-notifications.md`.

## What shipped

- Office one-off create: `notifyCustomerOfficeVisitCreated` after `createScheduledVisit` saves a scheduled visit with no series. The visit is loaded again by `tenant_id`.
- Instant booking repeat: `finalizeInstantBookingRecord` calls `notifyCustomerRecurringSeries` with action `created` only when `finalized` is true and `recurring_rule_id` is set. The booking confirmation still sends.
- One series date: `deleteScheduledVisit` emails after the delete when `recurring_rule_id` is set. The copy is that date only.
- Hour-change approve or deny: `notifyCleanerOfHoursChangeDecision`, Auth login email, same suppression and membership rules as a time-off decision.
- Cleaner cancels their own pending time off: `notifyOfficeOfTimeOffCancellation` after the pending row updates. Owners and admins, then the office fallback, with suppression.

## Race on series create

`seriesCreateIdempotencyId` is the insert id. It is a UUID from tenant, customer, repeat rule, anchor instant, and the two-minute bucket. Two concurrent creates collide on the primary key (`23505`) and the loser does not email. The earlier read of recent rows still covers a row that was saved with a random id. No migration and no new unique index.

## Still not emailed

- A time change on one office visit.
- Deleting a visit that is not part of a series.
- Moving one series occurrence (the old slot is skipped so it is not generated again; the visit still exists at the new time).
