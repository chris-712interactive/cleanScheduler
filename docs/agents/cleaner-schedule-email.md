# Cleaner schedule email

Product copy is `docs/product/cleaner-schedule-email.md`.

## Decisions

- Mail goes through `sendTransactionalEmail` in `lib/email/resend.ts` (Resend). No new provider. The brand is `platformEmailBrand()`, same as time-off mail to staff.
- `diffCleanerScheduleChanges` in `lib/email/cleanerScheduleChange.ts` is the pure before/after diff. Kinds are `added`, `removed`, `time_changed`, `order_changed`, and `cancelled`. A visit missing from the after snapshot is cancelled for whoever was assigned. Identical instants and the same assignee set do not count. Assignee order does not count.
- `selectCleanerScheduleRecipients` drops inactive members and blank emails. The actor is included only when another cleaner's notice is in the same batch. `actorUserId` null (quote accept, instant booking) emails every affected cleaner.
- Login email comes from `auth.admin.getUserById`. Do not read `user_metadata`.
- `queueCleanerScheduleNotice` calls `after()` from `next/server` so the save returns without waiting on Resend. If `after()` cannot run, the send continues in the background. Either path catches errors and logs `[cleanerSchedule]`. A thrown send does not fail the save.
- Idempotency key is `cleaner-schedule-` plus a sha256 of tenant, user, and the change list. Resend keeps that key for 24 hours. The key is the SDK `idempotencyKey` option, not a database outbox. No migration.
- `OUTBOUND_SUPPRESSED=1` is checked inside `sendTransactionalEmail` before a client is constructed. `deliverCleanerScheduleEmails` still calls that function when the switch is on, so the suppression log line is written and Resend is not called. When Resend is unset and the switch is off, the send is skipped.
- The schedule link uses `publicEnv.NEXT_PUBLIC_APP_DOMAIN` and the tenant slug: `https://{slug}.{domain}/schedule?date={firstAffectedDay}&view=day&employee=me`. Local hosts use `http`.
- Day rows are loaded after the diff, in the deferred send, for the affected dates. A failed day load still sends the change list and tells the cleaner to open the schedule. It does not say the day is empty.
- Dispatch builds before/after from the snapshot and plan already in memory (`scheduleVisitsFromDispatch`) after `apply_cleaner_dispatch` returns. The SQL function still does not send mail.
- Stop order loads visit rows before the writes and applies the new numbers with `scheduleVisitsAfterStopOrder` only after every update succeeds.
- Quote auto-schedule and instant booking call the same queue. Instant booking sends only when `finalize_instant_booking` reports `finalized: true`.

## Gaps

- Recurring materialization does not assign crew.
- Time off approval does not move visits.
- Price, notes, check-in, and completion are not schedule changes.
- A stop-order loop that errors mid-way has already written some numbers and does not email.

## Tests

`lib/email/cleanerScheduleChange.test.ts` covers the diff, the actor rule, inactive and missing emails, HTML escaping, the tenant-host link, dispatch and stop-order snapshots, and a stable idempotency key.

`lib/email/notifyCleanerScheduleChanges.test.ts` covers suppression (Resend `emails.send` is not called) and a provider failure that does not throw.
