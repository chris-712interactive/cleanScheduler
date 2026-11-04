# Subscription visit coverage

**Status:** Implemented. Apply migration `0117_subscription_visit_coverage.sql`.  
**Date:** 2026-11-04

Customer guide and entitlement changes wait until the first slice ships. Subscription checkout already requires a paid workspace and completed Stripe Connect. This feature stays inside that gate. No new platform price.

## Problem

A cleaning company sells a monthly plan for bi-weekly service. The customer is paying for two cleans in that billing period. Some periods contain a third visit. The monthly Stripe charge can land after those visits have already happened, or it can fail and leave the next appointment unpaid.

Today those facts never meet.

- A service plan is a Stripe price and a billing interval (`week`, `month`, or `year`). It does not say how many cleans the charge includes.
- Recurring visits are a separate calendar. Completing one always creates a customer invoice in `applyVisitCompletionBilling`, then either records cash or check or emails the invoice.
- `invoice.paid` and `invoice.payment_failed` on the connected account mirror a `tenant_invoices` row (`source = stripe_billing`). They do not attach that payment to any visit.
- A failed charge becomes `past_due` on `customer_subscriptions`. The schedule issues queue does not look at it, so the office can still send a crew to a clean the plan was supposed to fund.

## What this is

One billing period of a customer subscription grants a fixed number of cleans. Visits in that period consume the grant in calendar order. The office can see, for each subscription, how many cleans were paid, how many were completed, how many are waiting on the charge, how many are extra, and how many paid cleans are not on the calendar.

End-of-visit billing follows that grant. A clean inside the grant does not get a second invoice. Extra work on that clean, and a clean past the grant, do. A charge that fails leaves upcoming visits visible to the office as unpaid.

## What this is not

- A spendable credit wallet. Dollar credits for promos and refunds stay on the customer wallet. An unused included clean expires with the period.
- A second way to build the calendar. Recurring visit rules still create appointments. The plan does not materialize visits.
- A promise that every calendar month has exactly two bi-weekly cleans. Bi-weekly is every 14 days. The grant is the number on the plan, counted inside the Stripe billing period.
- Automatic cancellation of a visit when a card fails or the plan is paused. The office decides whether to collect at the door, wait, skip, or move the appointment.
- Automatic math that turns a partial refund into a new clean count. The office sets the date coverage stops.
- A customer email for each covered clean. The portal shows the state. Stripe already emails a failed charge.

## Plan setup

Add three fields to `service_plans`:

| Field                  | Meaning                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `included_cleans`      | How many service visits one successful charge covers. Required on new plans. `2` for a monthly bi-weekly plan.                  |
| `service_cadence`      | `weekly`, `biweekly`, or `monthly`. Display and a mismatch warning against the recurring rule. It does not calculate the grant. |
| `overage_amount_cents` | Price of one clean past the grant. Optional. When it is empty, an extra clean uses the visit's `expected_amount_cents`.         |

Existing plans keep `included_cleans` null. Those subscriptions keep today's behavior: the Stripe charge and the visit invoice stay independent. The office opts in by editing the plan and setting the count.

The count and the overage price are copied onto each grant when the charge succeeds. Editing the plan later changes the next charge for every customer on that plan. It does not rewrite a grant already opened. A different count for one customer is a separate plan. A mid-period switch to that plan leaves the open grant as it was. The next regular charge uses the new plan.

A subscription is for one property. One open subscription per property. Checkout from the customer profile asks which property when the customer has more than one. A second home is a second subscription. A subscription saved with no property covers that customer's only property. When a second property is added, that subscription is bound to the property the customer already had. The new property is uncovered until it has its own subscription.

Consultations never consume a grant. An initial or deep clean, using the same detection as schedule fill (one-time line, job type schedule role Initial visit, or a title like "Initial Deep Cleaning"), never consumes a grant. Those visits keep the current completion invoice.

A visit that already has a completion invoice, or that was completed before this subscription existed, stays on that invoice. Starting a plan does not rewind it and does not refund a quote prepay.

## Which subscription states count

| Status                             | Visits in the period                                                                                                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `active`                           | Grant rules below.                                                                                                                                                                                                     |
| `trialing`                         | Same as "no charge yet," up to `included_cleans`. A paid invoice for the trial, including a $0 invoice, opens the grant and covers those waiting visits. If the trial ends with no grant, waiting visits are invoiced. |
| `past_due`, `unpaid`               | Waiting, plus the unpaid-upcoming queue.                                                                                                                                                                               |
| `paused`                           | Per-visit invoices. Upcoming visits show "Subscription paused." They are not labeled unpaid.                                                                                                                           |
| `incomplete`, `incomplete_expired` | Per-visit invoices. The subscription does not cover anything until a charge succeeds.                                                                                                                                  |
| `canceled`                         | Leaving-the-plan rules.                                                                                                                                                                                                |

## The grant

A grant is one row per paid subscription charge.

| Column                       | Meaning                                                                                               |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- |
| `customer_subscription_id`   | The subscription.                                                                                     |
| `stripe_invoice_id`          | Unique when the charge came from Stripe. Webhook retries do not create a second grant.                |
| `tenant_invoice_id`          | The mirrored `tenant_invoices` row (`source = stripe_billing`).                                       |
| `period_start`, `period_end` | The invoice period already stored on that mirror.                                                     |
| `included_cleans`            | Copied from the plan at grant time.                                                                   |
| `overage_amount_cents`       | Copied from the plan at grant time.                                                                   |
| `coverage_ends_on`           | Empty until the office ends an annual plan early. Visits on or after this date are outside the grant. |
| `status`                     | `open`, `disputed`, or `reversed`.                                                                    |

These charges open a grant when the plan has `included_cleans`:

- Stripe `invoice.paid` whose billing reason is `subscription_create` or `subscription_cycle`. A $0 paid invoice counts. A proration invoice (`subscription_update`) does not.
- The mirrored subscription invoice reaching paid in full by a manual payment (check, cash, or a recorded transfer). That path calls the same grant function. The Stripe id keeps it idempotent.

`invoice.payment_failed` does not create a grant. It marks the current period unpaid and refreshes the office queue.

A partial refund leaves the grant `open`. A bank dispute moves it to `disputed`. Cleans already covered stay covered while the dispute is open. Upcoming visits in that period show as unpaid. If the dispute is won, the grant returns to `open` and the unpaid flag drops where the grant still has room. If the dispute is lost, the grant is reversed.

`invoice.voided`, a full refund, and a lost dispute reverse the grant. Each completed visit that was covered or waiting, and that has no visit invoice of its own, gets the normal visit invoice at that moment. The office is not left with finished cleans and no bill. Visits on a grant that stays paid are left alone.

The office can set `coverage_ends_on` on an open grant. That is how an annual plan stops mid-year after a partial refund. Cleans already covered stay covered. Cleans on or after that date are per-visit. The product does not derive the date from the refund amount.

Allocation, reversal, and reclassification run in one database transaction and lock the grant row. `invoice.paid` and visit completion can arrive together.

A grant covers visits in its own period only. A later month's payment does not take an earlier month's waiting cleans. A makeup slot is the one thing that crosses periods.

## How a visit is classified

Only a `visit_purpose = service` visit for the subscription's customer and property is eligible. The visit's `starts_at` picks the period. Completion the next morning still belongs to the day it was scheduled.

Slots are reserved in calendar order, not completion order. Occupying rows for the period are sorted by `starts_at`, then `created_at`:

- Scheduled, waiting, and covered visits.
- A customer skip or a customer cancellation. It occupies a slot so a later clean does not become free.
- A company cancellation does not occupy a slot.

The first `included_cleans` rows in that list are inside the grant. Anything past them is extra. Completing Thursday's clean before Tuesday's is closed does not let Thursday take Tuesday's slot.

For an eligible visit, in order:

1. **Already covered by a grant**, or already on a visit invoice. It stays there.
2. **Its place in the order is inside the grant, and a paid grant has room.** Covered.
3. **Its place is inside the grant, and the charge is unpaid, missing, or still in trial.** Waiting. No visit invoice yet.
4. **Its place is past the grant.** Extra.

When a grant is created, it covers the oldest waiting visits whose place is inside the grant. Visits already invoiced stay invoiced. The successful charge does not void them.

When a company cancellation removes an earlier row, later scheduled and waiting visits are classified again. An extra visit that already has an invoice stays invoiced. The office can choose "This was included" on that invoice: the grant must have room, an open invoice is voided, a paid invoice is refunded, and the visit becomes covered.

## Worked example

Monthly plan, `included_cleans = 2`, visits every 14 days. The charge has not succeeded yet. Three cleans fall in the period.

| Order by date | On completion                                                                             | When `invoice.paid` arrives                       |
| ------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| 1st clean     | Waiting. No invoice. No cash or check prompt.                                             | Covered by the grant.                             |
| 2nd clean     | Waiting. Same.                                                                            | Covered by the grant.                             |
| 3rd clean     | Extra. Invoiced at the plan's overage price, or at the visit price when overage is empty. | Left on that invoice. The grant does not take it. |

The charge retires the two cleans the plan sold. The third remains a normal billed visit.

If the card succeeds on the first day of the period, the first two completions are covered immediately and the third invoices at the door. Same order, earlier grant.

If the crew completes the third visit first, it is still the extra. The first two still take the grant when they are completed or when the charge succeeds.

## End of a visit

`applyVisitCompletionBilling` branches before it creates the base invoice.

| Classification                           | What the crew sees                                                                                    | What is stored                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Covered                                  | "Included in the subscription." No payment question. Optional extra-work amount.                      | Visit completed. Link to the grant. `completion_invoice_id` stays empty unless they add extra work. |
| Waiting                                  | "Waiting on this period's subscription charge." No payment question. Same optional extra-work amount. | Visit completed. Coverage status `waiting`.                                                         |
| Extra, or any visit that is not eligible | Today's flow, priced at the overage amount when the plan has one.                                     | Open or paid `tenant_invoices` row tied to the visit.                                               |

Extra work on a covered or waiting visit creates its own open invoice for the amount entered, linked to the visit. The base clean stays inside the grant. The crew can finish the included clean and still bill an oven, a fridge, or another room.

The office can choose "Invoice this clean" on a waiting visit when the card is not going to succeed. That visit leaves the waiting pool, is priced like an extra, and will not be taken when a later charge succeeds.

The visit keeps `expected_amount_cents`. Payroll and job costing read that amount when there is no completion invoice. The subscription invoice remains the customer's payment for included cleans. A covered visit is not a second sale.

A field employee can complete a covered or waiting visit without a price on file. An extra visit, an add-on, and "Invoice this clean" still require a price. The missing-price messages already in the product apply.

Returning a completed visit to scheduled clears its coverage link. An unpaid add-on invoice on that visit is voided. A paid add-on stays, and the office refunds it with the existing refund action. The slot is free for the visit still on the calendar.

## Failed charge and upcoming appointments

After `invoice.payment_failed`, while the subscription status is `past_due` or `unpaid`, and while a grant is `disputed`:

- Do not grant cleans.
- Eligible visits already completed in that period stay waiting, unless the office invoiced them.
- Every upcoming eligible visit in the next 21 days is a schedule issue, kind `unpaid_subscription`, label "Subscription unpaid."
- The home queue gains a line next to reschedule requests: a count of those upcoming visits, linking to the schedule issues tab.
- The visit detail page shows the failed charge, the hosted Stripe invoice link already mirrored on `tenant_invoices`, and the next visit date.

The visit stays on the calendar. Stripe keeps retrying the invoice and emailing the customer. This product's new notice is for the office, so they do not dispatch a clean that has no paid grant.

When a later `invoice.paid` arrives, allocation covers the waiting visits that sit inside the grant. The unpaid issue drops off any upcoming visit that now has a slot. An upcoming visit past the grant stays extra and is billed on completion.

## Pause, skip, and a paid period with no visits

A paused subscription grants nothing. Completing a visit invoices it. Upcoming visits show "Subscription paused" so the office can take them off the route. They are not dispatched as if the plan were paying.

A customer skip uses one included clean. That includes a skip of a recurring occurrence before a visit row exists (`recurring_appointment_occurrence_skips`) and a cancellation the office records as the customer's. The clean does not move to next month. A company skip does not use a clean. The skip and cancel actions ask who requested it when the property has a coverage subscription. There is no silent default.

An open grant whose period has started, and which has fewer occupying rows than `included_cleans` and no upcoming eligible visit, shows on the subscription card and the home queue as "Paid cleans with nothing scheduled." The recurring rule was turned off, or the occurrences were removed, while the card is still being charged.

## Reschedule and cancel

Moving a visit changes `starts_at` and keeps the same visit row.

- Already covered: it stays on that grant. The new date does not consume a second clean.
- Not yet covered: classify again from the new date and the new order.

Cancelling a visit that occupies a slot records who cancelled.

| Who cancelled                                     | Effect                                                                                                                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Company, visit was covered, waiting, or scheduled | The row stops occupying a slot. Later visits in the period are classified again. If this visit had already used a paid slot, that slot becomes a makeup. The office sees "Makeup owed" until the next eligible completed visit takes it, or someone dismisses it. |
| Customer                                          | The slot stays used for this period.                                                                                                                                                                                                                              |
| Office override                                   | Either release or keep, recorded on the visit.                                                                                                                                                                                                                    |

A company reschedule is a move, so it does not release a slot. A makeup is one owed clean, not a dollar credit. The next completed service visit for that property takes it before any new grant slot is used, including a visit after the customer has gone back to paying per clean, and including the first visit after they subscribe again.

## Leaving the plan

The office cancels at period end, which is the action already on the customer profile. Stripe stops the next charge. The recurring visit rule stays. The customer keeps the same appointments and pays for each one after it is done.

Through the end of the paid period, the grant still applies. A clean with `starts_at` inside that period is covered while its place is inside the grant, including one completed the morning after the period ends. A clean already tied to that grant stays covered if it is moved past the end date. It does not get a second invoice.

The first clean whose `starts_at` is after the period ends, and that is not already covered and is not a makeup, uses today's completion flow. The unpaid-subscription issue comes off upcoming visits once the subscription is `canceled`. Those visits are pay-per-clean on purpose.

An unused included clean expires with the period. A makeup the company still owes is the exception. That one slot still covers the next completed service visit at that property. The visit after it invoices one at a time.

If the period ends with completed visits still waiting and no paid grant, each of those visits gets the normal visit invoice. The same invoice step runs when a grant is reversed.

## Where it shows

- **Service plans.** Amount, billing interval, cadence, cleans included per charge, and optional overage price. The callout stays: the plan charges the card, the recurring rule fills the calendar. One line when both exist for the same property and the cadence does not match the rule. Editing the count warns that every customer on the plan changes on the next charge.
- **Customer profile, subscription card.** This period: paid, disputed, or unpaid; covered; waiting; extra; makeup owed; paid cleans with nothing scheduled. Link each covered visit and the Stripe invoice. Actions: invoice a waiting clean, mark an extra invoice as included, end coverage on a date, dismiss a makeup.
- **Visit detail and the completion modal.** Covered, waiting, extra, and add-on. Cancel and occurrence skip ask company or customer.
- **Schedule issues and the home queue.** `unpaid_subscription`, `subscription_paused`, and paid cleans with nothing scheduled. Makeup owed stays on the subscription card.
- **Customer portal.** On the visit: "Included in your plan," "Billed separately," or "We are waiting on the plan payment." The subscription page lists the same counts. No new self-serve subscribe flow.

## Build slices

**Slice 1 — grant and visit billing.** Migration for plan fields, property on `customer_subscriptions`, grant table, visit coverage, and skip forfeits. Classification in calendar order. `invoice.paid` for create and cycle invoices, including $0. Visit completion branches. Overage price. Add-on invoice. Already-invoiced visits stay invoiced. Customer card and visit detail. Legacy null plans unchanged.

**Slice 2 — money and the office queue.** Failed, paused, disputed, and paid-but-unscheduled queues. Manual payment in full on the mirrored subscription invoice opens the same grant. "Invoice this clean" and "This was included." Full reversal invoices the finished cleans. Partial refund leaves the grant. Binding a null subscription to the original property when a second property is added.

**Slice 3 — schedule changes and the portal.** Company or customer on cancel and occurrence skip. Makeup, including after cancel and after they subscribe again. End coverage on a date. Return a completed visit to scheduled. Customer portal copy. Cadence mismatch warning.

## Tests

- Paid grant covers the oldest two waiting visits and leaves the third invoiced at the overage price.
- A grant that exists before the visits covers the first two at completion and invoices the third.
- Completing the later visit first does not take an earlier visit's slot.
- `invoice.paid` twice for the same Stripe invoice creates one grant. A proration invoice creates none. A $0 cycle invoice creates one.
- A manual payment that marks the mirrored subscription invoice paid in full creates one grant. A second payment event does not create another.
- A visit that already has a completion invoice is not covered when the customer later subscribes.
- A visit moved to another day does not consume a second slot.
- A company cancel returns one slot and reclassifies a later scheduled visit. An extra invoice already sent stays until the office marks it included.
- A customer cancel, and a customer occurrence skip, each keep one slot used.
- A consultation and an initial deep clean still invoice.
- A plan with `included_cleans` null still invoices every completion.
- An add-on amount on a covered visit creates an invoice for that amount only.
- "Invoice this clean" on a waiting visit stays invoiced after the charge succeeds.
- A failed charge adds `unpaid_subscription` to an upcoming visit and removes it after the retry succeeds and the grant has room.
- A paused subscription invoices the completion and labels upcoming visits paused.
- An open grant with no upcoming visit appears as paid cleans with nothing scheduled.
- A partial refund leaves covered visits covered. A full refund invoices each finished clean that has no visit invoice.
- A dispute flags upcoming visits. A won dispute clears that flag. A lost dispute invoices the finished cleans.
- After cancel at period end, a visit inside the paid period stays covered and the next visit after that period invoices on completion.
- A makeup still owed covers one visit after the subscription is canceled, and covers one visit before the new grant when they subscribe again.
- Waiting visits left at period end with no paid grant each receive a visit invoice.
- `coverage_ends_on` leaves earlier cleans covered and invoices a clean on that date.
- Adding a second property binds a null subscription to the original property.

## Files this will touch

- `supabase/migrations/` — plan fields, subscription property, grants, visit coverage, skip forfeits.
- `lib/stripe/connectInvoiceWebhookHandlers.ts` — grant on paid, flag on failed, reverse on void.
- `lib/stripe/connectChargeMirrorHandlers.ts` — dispute opened, won, and lost.
- `lib/billing/completeVisitWithBilling.ts` — branch before `createVisitInvoice`.
- Manual invoice payment recording — grant when a subscription invoice reaches paid in full.
- `app/tenant/billing/invoiceRefundActions.ts` — full refund reverses, partial refund does not.
- `app/tenant/schedule/visitFieldActions.ts` and `CompleteVisitPaymentModal.tsx` — completion, add-on, cancel reason.
- `lib/schedule/recurringOccurrenceSkips.ts` — company or customer forfeit.
- `app/tenant/billing/service-plans/` — plan fields and the edit warning.
- `app/tenant/customers/RecurringBillingPanel.tsx` — period counts and office actions.
- `lib/tenant/scheduleIssuesQueue.ts` and `lib/tenant/dashboardTodayQueue.ts` — unpaid, paused, and unscheduled.
- Property create — bind a null subscription to the original property.
- `app/customer/subscriptions/page.tsx` and the customer visit list — portal copy, in slice 3.
