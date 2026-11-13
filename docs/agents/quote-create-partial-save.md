# Quote create: partial save after the RPC

Learned while fixing the quote wizard duplicate that QA saw when entry codes failed after `tenant_quote_create_with_line_items` succeeded (often because `PROPERTY_ACCESS_CODE_KEY` was unset).

## Rule

Once `createTenantQuote` has a quote id from that RPC, the action returns `{ success: true, quoteId, warning? }`. It does not return `error` without `quoteId`. The wizard navigates to `/quotes/{quoteId}` and blocks another submit. `warning` is a comma-separated list of notice codes mapped by `quoteSaveNotice` in `lib/tenant/quoteStructuredFields.ts`.

Follow-ups that must stay non-fatal:

- copying bedrooms, bathrooms, square feet, stories, and site notes onto the location
- `savePropertyAccessCodes` (including a thrown encryption error)
- reloading the quote, location property type, pipeline stage, crew size, and promotion side effects
- customer email, SMS, and `quote.sent` webhook

## Retry

The wizard mints one UUID per visit and posts it as `create_idempotency_key`. That key is kept in `sessionStorage` (`cleanscheduler.quoteCreate.idempotencyKey`) with the wizard path and a submitted flag. It is reused only when that same wizard path is reloaded, or when the browser restores it (Back / forward), and only after a submit has started. A later client-side visit mints a new key. The document's navigation type stays `reload` after a reload, so a later visit must not trust that type by itself. A successful create clears the key, except when the warning still contains `quote-in-flight`. `tenant_quote_create_requests` (migration `0127_quote_create_idempotency`) stores that key, the quote id, and a per-step result: `pending`, `ok`, `failed`, or `skipped`, plus `claimedAt` and `claimToken`. Apply `0127` on dev and prod before deploying this code. Until the table exists, quote create fails closed and does not insert a quote. That error names `0127_quote_create_idempotency`. Other claim failures stay on the generic confirm message. No further migration is required for the claim clock; it lives in the existing `follow_ups` JSON.

Do not resume from `_prev.quoteId` or `_prev.warning`. Both are client-controlled. A replay happens only when the same tenant and key already have a quote id. It claims each `failed` step, and each `pending` step whose `claimedAt` is missing or at least 3 minutes old, with one compare-and-set (`follow_ups` equality and `follow_ups->>step` still the previous state). Only the claim winner runs that step. Email, SMS, and webhook stop waiting after 45 seconds, and a result that arrives after that deadline is stored as failed rather than sent. The same server process will not start a second provider call for that channel while the first promise is still unsettled. sent.dm receives that attempt's idempotency key. Webhook enqueue uses the same kind of id so one claim does not insert two deliveries. A step that is still fresh `pending` is left alone and reported as `quote-in-flight`. That notice tells the office to go back to the quote form and save again; refreshing the quote page does not retry. A result of `ok` is never overwritten, and a writer whose `claimToken` does not match does not store a later failure. If the compare-and-set misses five times, the action reports the step as failed instead of success. The wizard key is reused for a reload of this form, or when the browser history entry still carries the same visit id. A later New quote visit, including one that follows an unrelated Back, gets a new key. A duplicated browser tab can still insert a second quote. Replay does not change status. Notification channels retry only when that channel was claimed and the quote is already `sent`, and the retry uses the stored quote title, not the title on the resubmitted form. Accepted, declined, expired, and locked quotes are not written and are not notified. Their warning lists the failed steps (`location-facts`, `entry-codes`, `quote-follow-up`, `quote-notify`), not one location message for every failure. A lookup error returns an error and does not report success. A key that is not a UUID is rejected. A claim with no quote id yet means another request is in flight; do not insert again.

Do not read `user_metadata` for this. Do not log or return gate, door, or garage codes, ciphertext, or `PROPERTY_ACCESS_CODE_KEY`.

`quoteSaveNotice` only reads own string values. Query keys such as `constructor` or `toString` are not rendered.

## Send

Sending still runs on the first request when the office chose send. Entry codes are office/crew data and are not on the customer quote. Email, SMS, and the webhook each return success or failure, including provider failures that used to be logged without throwing. A failed channel is stored on the idempotency row and can be retried by another submit of the same key. A channel already marked `ok` is not sent again. The quote page states that it does not send the notification again; there is no separate resend button, because `moveTenantQuoteStatus` does nothing when the quote is already sent and a button would need its own eligibility rules.
