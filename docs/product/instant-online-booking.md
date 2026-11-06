# Instant online booking

**Status:** Shipped  
**Tier:** All plans that include `publicBookingRequest` (Starter and above)  
**Migration:** `0119_instant_online_booking.sql`

## What it is

`https://{tenant-slug}.{apex}/book` (also `/request`) follows one tenant setting with three modes:

| Mode            | Public page                                                                                                                                    | What gets created                                                                                                                                                                                        |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Off             | Friendly “Online booking is unavailable right now.” page. Marketing-site buttons and nav items that point at `/book` or `/request` are hidden. | Nothing                                                                                                                                                                                                  |
| Request only    | The existing quote request form                                                                                                                | A `tenant_marketing_leads` row (`source = quote_request`) and an office email                                                                                                                            |
| Instant booking | Service, home details, live times, price, then confirm                                                                                         | A customer (matched by email), a residential property, a `tenant_scheduled_visits` row, an assignee, and a `recurring_appointment_rules` row when the customer picks weekly, every two weeks, or monthly |

Existing workspaces stay on their current behavior. A form that was turned off becomes **Off**. Everyone else stays **Request only**. Instant booking is opt-in.

The mode is enforced on the page and on every public submit action. A request posted while the mode is instant, or an instant booking posted while the mode is request or off, is rejected.

## Tenant setup

Settings → **Online booking**

- Mode: Off, Request only, or Instant booking
- Instant policy: lead time, how far ahead customers can book, buffer between jobs, slot step (15/30/60), flat deposit, optional “save a card” when the deposit is $0, travel speed used for the gap between jobs, and which repeat frequencies are offered
- ZIP codes on service zones. If none are set, every address is in range. If any zone lists ZIP codes, other ZIPs are declined. An offer can be limited to a subset of those zones.
- Bookable services: name, duration, price (flat, base + per sq ft, or base + beds and baths), optional link to a service plan or service template, and zones

Linking a plan or template does **not** start a Stripe subscription. The price the customer sees is the offer price. A repeat choice creates a recurring visit rule, the same records Schedule → Recurring uses. The first visit is staffed. Later occurrences are materialized by the existing recurring job and are not auto-assigned.

Instant offers default to a residential audience. `resolveTenantBookingSegment()` in `lib/booking/bookingAudience.ts` is the checkpoint for the tenant service-segment setting. Until that setting is passed in, the segment is residential, so commercial-only offers stay hidden.

## Customer flow

1. Pick a service.
2. Enter contact details and the home. Square footage is required for per-sqft pricing. Beds and baths are required for beds-and-baths pricing.
3. See a price and open times. Times come from business hours, each crew member’s hours, approved time off, scheduled visits, and unexpired holds. The buffer and an estimated drive (straight-line minutes, or same-city / same-state fallback from `lib/schedule/optimizer/geo.ts`) must fit between jobs.
4. Choose one-time or a repeat frequency and confirm.
5. If a deposit or saved card is configured, Stripe Checkout runs on the tenant’s Connect account. The visit is created only after Checkout completes (return URL and the Connect webhook both finalize, and the database function is safe to call twice). With no payment, the visit is created immediately.
6. The customer gets a confirmation email. SMS reuses the existing visit-reminder template when visit-reminder SMS is on and a phone was entered. The office email (site contact email, otherwise the business email) is notified. The visit shows on the schedule.

## Concurrency and security

`hold_instant_booking` takes a transaction advisory lock per tenant and crew member, deletes expired holds, rejects overlaps with scheduled visits (including the buffer), and inserts a slot lock. `tenant_booking_slot_locks` has a GiST exclusion constraint so two overlapping locks for the same person cannot commit. `finalize_instant_booking` creates the visit, assignee, and optional recurring rule in that same locked transaction, then drops the hold.

Both functions are `security definer`, revoked from `anon` and `authenticated`, and granted to `service_role` only. New tables use the same member RLS policy as the rest of the tenant data. Public routes never use the anon key.

Preview is rate-limited per IP. Confirm is rate-limited per IP and per email. A honeypot field drops bot posts. The action also checks that the host tenant matches the submitted slug.

## Key files

| Layer               | Path                                    |
| ------------------- | --------------------------------------- |
| Public page         | `app/book/page.tsx`                     |
| Request action      | `app/book/actions.ts`                   |
| Instant actions     | `app/book/instantActions.ts`            |
| Slot math           | `lib/booking/computeInstantSlots.ts`    |
| Booking transaction | `lib/booking/confirmInstantBooking.ts`  |
| Checkout            | `lib/booking/instantBookingCheckout.ts` |
| Settings            | `app/tenant/settings/booking-requests/` |

## Out of scope

- Embeddable widget
- Multi-person crews on the public slot (one available person is assigned; default crew size is 1)
- Stripe subscription billing for the recurring choice
- A dedicated sent.dm template (confirmation SMS uses the visit reminder template)
- Automatic refunds if a paid hold expires before finalize
- Commercial booking questions (suite, after-hours). Add them when `resolveTenantBookingSegment()` starts returning the tenant’s segment.
