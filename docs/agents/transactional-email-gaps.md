# Transactional email gaps after series and time-off mail

Product copy is `docs/product/recurring-series-email.md` and `docs/product/time-off-notifications.md`.

## What shipped

- Office one-off create: `notifyCustomerOfficeVisitCreated` after `createScheduledVisit` saves a scheduled visit with no series. The visit is loaded again by `tenant_id`.
- Instant booking repeat: `finalizeInstantBookingRecord` calls `notifyCustomerRecurringSeries` with action `created` only when `finalized` is true and `recurring_rule_id` is set. The booking confirmation still sends.
- One series date: `deleteScheduledVisit` emails after the delete when `recurring_rule_id` is set. The copy is that date only. The action calls `canManageScheduledVisit(membership.role)` immediately after `requireTenantPortalAccess`, before the admin client, the delete, or the email. That role is the active `tenant_memberships.role` (owner or admin). A field employee gets "Only owners and admins can delete a visit." and nothing is written.
- Hour-change approve or deny: `notifyCleanerOfHoursChangeDecision`, Auth login email, same suppression and membership rules as a time-off decision.
- Cleaner cancels their own pending time off: `notifyOfficeOfTimeOffCancellation` after the pending row updates. Owners and admins, then the office fallback, with suppression.
- Office visit time change: `notifyCustomerOfficeVisitRescheduled` after `updateScheduledVisitTimes` saves a new start or end on a visit with no series. The same window does not send. The role check is `canManageScheduledVisit` before the admin client.
- One-off delete: `notifyCustomerOfficeVisitCancelled` after `deleteScheduledVisit` removes a visit with no series. The owner/admin check still runs first.
- One series occurrence moved: `notifyCustomerSeriesOccurrenceMoved` after that same time save when `recurring_rule_id` is set. The note is that date's old and new time. The series-changed email and the one-date cancellation email are not sent. The old start is still skipped when it changes.

## Race on series create

`seriesCreateIdempotencyId` is the insert id. It is a UUID from tenant, customer, repeat rule, anchor instant, and the two-minute bucket. Two concurrent creates collide on the primary key (`23505`) and the loser does not email. The earlier read of recent rows still covers a row that was saved with a random id. No migration and no new unique index.

## Still not emailed

- Approving a customer's reschedule request already sends `notifyCustomerRescheduleResolved`. That path does not also send the office time-change or occurrence-move note.
