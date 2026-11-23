# Recurring series email

Product copy is `docs/product/recurring-series-email.md`.

## Decisions

- Mail goes through `notifyCustomerRecurringSeries` in `lib/email/recurringSeriesNotifications.ts`, which calls `sendTransactionalEmail`. No new provider. The brand is `loadTenantEmailBrand`.
- One send per series action: `created`, `changed`, or `cancelled`. `recurringSeriesChangeKinds` is frequency, anchor time, and cleaner display names. An empty diff does not send.
- The customer address is `customer_identities.email` for that `tenant_id`. Do not read `user_metadata`.
- `tenant_email_suppressions` for that tenant and normalized address skips the send. `marketing_email_opt_in` does not. Default false must not block this mail.
- The office actions email only after the series row write succeeds. A failed insert or update redirects with the error and does not call the sender. A failed send does not fail the save.
- A second create of the same customer, repeat rule, and anchor within two minutes reuses the row that already committed and does not insert or email again. The save button stays disabled while that submit is pending.
- Concurrent creates of that same series share one primary key: `seriesCreateIdempotencyId` (tenant, customer, rule, anchor instant, and the two-minute bucket). The second insert hits `23505` on `recurring_appointment_rules.id` and does not email. No new unique index. No migration.
- Idempotency key is `recurring-series-` plus a sha256 prefix of tenant, rule, action, and snapshot. A skipped occurrence uses `series-occurrence-`. A moved occurrence uses `series-occurrence-move-` and includes the previous and next window. An office one-off visit uses `office-visit-`. A time change uses `office-visit-time-`. Deleting that visit uses `office-visit-cancel-`. No outbox table. No migration.
- `OUTBOUND_SUPPRESSED=1` still calls `sendTransactionalEmail`, which returns before a client is constructed.
- Crew updates for upcoming visits live in `replaceFutureRecurringSeriesCrew`. The customer email is not sent if that write returns an error before the series row is updated. If the series row then fails, the customer is not emailed even if some visit crew rows already changed.
- Materialize must not import the sender. Instant booking still sends its confirmation. When finalize creates a recurring rule (`finalized` true and `recurring_rule_id` set), it also sends the series-created email once. A one-time booking and a finalize retry do not.

## One visit time, delete, and occurrence move

- `updateScheduledVisitTimes` checks `canManageScheduledVisit(membership.role)` immediately after `requireTenantPortalAccess` and before the admin client. That role is the active membership row. A field employee gets "Only owners and admins can change a visit time."
- After the time write succeeds, a visit with no series calls `notifyCustomerOfficeVisitRescheduled`. A visit on a series calls `notifyCustomerSeriesOccurrenceMoved`. Neither runs when the start and end are the same instant. A failed write does not send. A thrown send does not fail the save. Approving a customer reschedule request still uses `notifyCustomerRescheduleResolved` only.
- `deleteScheduledVisit` still checks the owner/admin role first. After a successful delete, a series visit calls `notifyCustomerSeriesOccurrenceSkipped`. A visit with no series calls `notifyCustomerOfficeVisitCancelled`.
- Moving one occurrence still records a skip for the old start when that start changes. The customer email is the move note (old and new time), not the cancellation note and not the series-changed note.
- `formatVisitWindow` is the only window string those emails use. A same-day window stays "Monday, June 8 at 9:00 AM – 11:00 AM". When the end is the next calendar day in the workspace timezone, the end includes that date: "Monday, June 8 at 10:00 PM – Tuesday, June 9 at 1:00 AM".
- A skipped series date uses that same helper with the deleted visit's start and end and `tenants.timezone`. The idempotency key stays the start instant (`series-occurrence-`), so adding the end does not send a second email for a date that was already skipped.
- Approving a customer reschedule request still uses only `notifyCustomerRescheduleResolved`. That note formats the applied window with `formatVisitWindow` in the workspace timezone. The send site passes the visit start and end loaded before the time write as the previous window, and the email includes it the same way a time-change note does. A decline has no window. `sendTransactionalEmail` catches a Resend failure and the decision sender does not throw, so the request save still succeeds. Do not also send the office time-change or occurrence-move note.

## Gaps left in place

- None of the three office actions above are still silent. A customer reschedule approval was already emailed and was left on that sender.
