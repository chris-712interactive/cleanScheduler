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

The wizard mints one UUID per visit and posts it as `create_idempotency_key`. `tenant_quote_create_requests` (migration `0127`) stores that key, the quote id, and a per-step result: `pending`, `ok`, `failed`, or `skipped`. Apply `0127` on dev and prod before deploying this code. Until the table exists, quote create fails closed and does not insert a quote.

Do not resume from `_prev.quoteId` or `_prev.warning`. Both are client-controlled. A replay happens only when the same tenant and key already have a quote id. It retries steps marked `failed` and does not change status. Notification channels retry only when that channel is `failed` and the quote is already `sent`. Accepted, expired, and locked quotes are not written and are not notified. A lookup error returns an error and does not report success. A key that is not a UUID is rejected. A claim with no quote id yet means another request is in flight; do not insert again.

Do not read `user_metadata` for this. Do not log or return gate, door, or garage codes, ciphertext, or `PROPERTY_ACCESS_CODE_KEY`.

`quoteSaveNotice` only reads own string values. Query keys such as `constructor` or `toString` are not rendered.

## Send

Sending still runs on the first request when the office chose send. Entry codes are office/crew data and are not on the customer quote. Email, SMS, and the webhook each return success or failure, including provider failures that used to be logged without throwing. A failed channel is stored on the idempotency row and can be retried by another submit of the same key. A channel already marked `ok` is not sent again. The quote page states that it does not send the notification again; there is no separate resend button, because `moveTenantQuoteStatus` does nothing when the quote is already sent and a button would need its own eligibility rules.
