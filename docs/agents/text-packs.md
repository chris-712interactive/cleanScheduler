# Text packs and applicant texting

Session notes for the prepaid text packs and the Business applicant SMS cap.

## Paid status

Texting and text pack checkout read `tenant_billing_accounts.status`.

Paid means the stored value `active` only. `canUseTexting` in `lib/billing/tenantSubscriptionAccess.ts` is that check. `canUseSmsCommunication` now calls it, so past due no longer sends texts.

Stripe still maps statuses in `mapStripeSubscriptionStatus` before they are stored:

| Stripe status                         | Stored `tenant_billing_accounts.status` | Can text |
| ------------------------------------- | --------------------------------------- | -------- |
| `active`                              | `active`                                | yes      |
| `paused`                              | `active`                                | yes      |
| `past_due`, `unpaid`                  | `past_due`                              | no       |
| `canceled`, `incomplete_expired`      | `canceled`                              | no       |
| `trialing`, `incomplete`, missing row | `trialing`                              | no       |

`paused` has no column of its own. It is stored as `active`, so it is treated as paid. That mapping was already in the subscription sync and was not changed.

## Allowance order

`reserve_sms_segments` counts this month's sent messages and open holds, then writes the hold and any pack debit under one tenant advisory lock. A failed send, including a provider success that logs zero segments, calls `release_sms_reservation` and refunds the pack debit. Text pack purchases require Business or Pro. Starter cannot buy a pack.

Stripe `paused` is not stored. `mapStripeSubscriptionStatus` still writes it as `active`, and that shared mapping was left unchanged. Excluding paused texting would need a new column for the raw Stripe status, written beside the mapped status. That is a broader change than the texting gate.

## Previous allowance notes

Customer texts stay on Pro and use `includedSmsCreditsMonthly` (25,000). Applicant texts on Pro use that same counter. Applicant texts on Business use `includedApplicantSmsCreditsMonthly` (100) and do not open customer texting. Starter has neither. The plan allowance is spent first. Pack segments cover only the remainder and do not reset each month.

Migration `0131_text_pack_ledger.sql` holds the ledger. Members can select their tenant. Authenticated cannot insert, update, or call `consume_text_pack_segments`. If the table is missing, monthly allowance texting still works and packs show as unavailable.

Checkout is one-time. `STRIPE_PRICE_TEXT_PACK_1000` and `STRIPE_PRICE_TEXT_PACK_2500` must both be set or the buy buttons stay hidden. Credits are inserted from `checkout.session.completed` when the amount matches $15 or $35 and the session id is new. The browser return does not add segments.

## Copy

Say text pack. Do not say add-on for this purchase. Warnings at 80% and 100% of the monthly allowance link to `/billing#text-packs`. Owners and admins buy. The lock message is "Texting unlocks once your subscription starts" with a link to `/billing`.
