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
- Idempotency key is `recurring-series-` plus a sha256 prefix of tenant, rule, action, and snapshot. A skipped occurrence uses `series-occurrence-`. An office one-off visit uses `office-visit-`. No outbox table. No migration.
- `OUTBOUND_SUPPRESSED=1` still calls `sendTransactionalEmail`, which returns before a client is constructed.
- Crew updates for upcoming visits live in `replaceFutureRecurringSeriesCrew`. The customer email is not sent if that write returns an error before the series row is updated. If the series row then fails, the customer is not emailed even if some visit crew rows already changed.
- Materialize must not import the sender. Instant booking still sends its confirmation. When finalize creates a recurring rule (`finalized` true and `recurring_rule_id` set), it also sends the series-created email once. A one-time booking and a finalize retry do not.

## Gaps left in place

- Changing the time of one office visit, or deleting a visit that is not part of a series, still does not email the customer.
- Moving one series occurrence to a new time records a skip for the old slot and does not send the one-date cancellation email.
