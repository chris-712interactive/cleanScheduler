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

`useActionState` sends the previous result back as `_prev`. That object is client-controlled. Resume only when the id is a UUID and `tenant_quotes` contains it for the authenticated tenant. A lookup error returns that id and does not call the RPC again. A missing id, or an id that is not a UUID, falls through to a normal create.

Resume repairs entry codes and other location follow-ups for a draft, sent, or declined quote. It does not change status and it does not notify. Accepted, expired, and locked quotes are returned as-is. Do not trust `_prev.warning` as a reason to send: the client can set `quote-notify` on any in-tenant id.

Do not read `user_metadata` for this. Do not log or return gate, door, or garage codes, ciphertext, or `PROPERTY_ACCESS_CODE_KEY`.

`quoteSaveNotice` only reads own string values. Query keys such as `constructor` or `toString` are not rendered.

## Send

Sending still runs on the first request when the office chose send. Entry codes are office/crew data and are not on the customer quote. Skipping the notification would leave a row already stored as `sent` that the customer never received. A later submit does not send again. Email, SMS, and the webhook are attempted separately so one thrown channel does not skip the others. The quote page warning is the signal when a channel throws; provider helpers log ordinary delivery failures and do not throw, and there is no second send from this action.
