# Starter customer emails (on-my-way + review request)

Transactional Resend emails available on **all plans** (including Starter). Opt-in via Settings → Operations. SMS parity is not included.

## On-my-way (`emailOnMyWay`)

- **When:** Crew or office taps **On our way** on a scheduled visit that has not been checked in yet (`notifyCustomerOnOurWayAction`).
- **Not sent:** Check-in does not send this email. Arrival is a separate action.
- **Toggle:** `tenant_operational_settings.email_notify_on_my_way` (default off). The button is hidden when the toggle is off.
- **Sender:** `lib/email/visitOnMyWayEmail.ts` → `maybeSendVisitOnMyWayEmail`.
- **Dedupe:** `tenant_visit_customer_email_log` kind `on_my_way`.

## Review request (`emailReviewRequest`)

- **When:** Service visit marked completed (`completeVisitWithPaymentAction`).
- **Skipped:** Consultations; missing customer email; empty `tenants.customer_review_url`.
- **Toggle:** `tenant_operational_settings.email_notify_review_request` (default off).
- **Review URL:** Business settings → Review link (`tenants.customer_review_url`, https only).
- **Sender:** `lib/email/visitReviewRequestEmail.ts` → `maybeSendVisitReviewRequestEmail`.
- **Dedupe:** `tenant_visit_customer_email_log` kind `review_request`.

## Migration

`0085_starter_value_pack.sql` — review URL column, ops toggles, dedupe log + enum.
