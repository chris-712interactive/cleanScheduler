# Cleaner schedule email

A cleaner gets one email when their assignments change. The message is from Clean Scheduler and uses the same Resend path as other staff mail. See `docs/product/email-branding.md`.

## What they receive

The subject is `{workspace}: your schedule changed`.

The body lists each change in the workspace timezone:

- Added
- Removed
- Time changed (previous time and new time)
- Stop order changed (previous stop number and new stop number)
- Cancelled (the visit was deleted or marked cancelled)

Under that, the email shows the cleaner's remaining visits on each affected day, in stop order when a stop number is saved, then by time. A day with nothing left says **Nothing scheduled.**

**View your schedule** opens `{slug}.{domain}/schedule?date=YYYY-MM-DD&view=day&employee=me` for the first affected day. Field employees already see only their own jobs on that page.

One save sends one email per cleaner, not one email per visit. A dispatch of a whole day is one message. Fill schedule is one message for every new assignment in that run.

## Who is emailed

Only a cleaner whose crew, time, stop order, or cancellation actually changed.

The person who saved is not emailed when the change affects only them. They are emailed when someone else's schedule changed in the same save and their own day changed too.

Inactive members are skipped. Members with no login email are skipped. The address is the account email from Auth, not `user_metadata`.

## When it sends

- **Apply dispatch**
- **Apply stop order**
- Schedule a visit with a crew, change the crew, change the start or end, or delete the visit
- Approve a customer reschedule request that moves the visit
- Apply a day suggestion
- Fill schedule, and undo a fill run
- A customer accepts a quote and auto-schedule assigns a cleaner
- Instant booking confirms a visit for the first time

The schedule still saves if email cannot be sent. Failures are logged. The same change uses a Resend idempotency key so a retry within 24 hours does not send a second copy. Dev and tests with `OUTBOUND_SUPPRESSED=1` do not call Resend.

There is no SMS for these changes.

## Not covered

- Recurring visit materialization does not assign a crew, so it does not send this email.
- Approving time off does not move visits. The office already gets the overlap email.
- Job price, notes, check-in, and completion do not send it.
- A stop-order save that fails partway does not send it.
