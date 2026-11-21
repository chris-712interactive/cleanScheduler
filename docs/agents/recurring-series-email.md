# Recurring series email

Product copy is `docs/product/recurring-series-email.md`.

## Decisions

- Mail goes through `notifyCustomerRecurringSeries` in `lib/email/recurringSeriesNotifications.ts`, which calls `sendTransactionalEmail`. No new provider. The brand is `loadTenantEmailBrand`.
- One send per series action: `created`, `changed`, or `cancelled`. `recurringSeriesChangeKinds` is frequency, anchor time, and cleaner display names. An empty diff does not send.
- The customer address is `customer_identities.email` for that `tenant_id`. Do not read `user_metadata`.
- `tenant_email_suppressions` for that tenant and normalized address skips the send. `marketing_email_opt_in` does not. Default false must not block this mail.
- The office actions email only after the series row write succeeds. A failed insert or update redirects with the error and does not call the sender. A failed send does not fail the save.
- A second create of the same customer, repeat rule, and anchor within two minutes reuses the row that already committed and does not insert or email again. The save button stays disabled while that submit is pending. There is no unique index.
- Idempotency key is `recurring-series-` plus a sha256 prefix of tenant, rule, action, and snapshot. No outbox table. No migration.
- `OUTBOUND_SUPPRESSED=1` still calls `sendTransactionalEmail`, which returns before a client is constructed.
- Crew updates for upcoming visits live in `replaceFutureRecurringSeriesCrew`. The customer email is not sent if that write returns an error before the series row is updated. If the series row then fails, the customer is not emailed even if some visit crew rows already changed.
- Materialize must not import the sender. Instant booking keeps its existing confirmation and does not send a second series email.

## Gaps left in place

- Office one-off visit create, time change, and delete still do not email the customer.
- Hour-change approval or denial does not email the employee.
- A cleaner cancelling their own pending time off does not email the office.
- Deleting one occurrence does not send a series email.
