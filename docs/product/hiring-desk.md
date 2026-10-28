# Hiring desk

Customer guide: [hiring-desk-guide.pdf](hiring-desk-guide.pdf), regenerated with `npm run hiring-guide:pdf`.

**Status:** Phase 1 implemented — review before production use  
**Date:** 2026-10-26  
**Migration:** `0115_hiring_desk.sql`

## Packaging

**Include the desk on Business and Pro. Do not sell it as an add-on in v1. Do not put it on Starter. Keep it off the free trial. SMS to applicants stays on Pro, using the SMS credits Pro already includes.**

|                                | Starter | Business                           | Pro                                | Trial |
| ------------------------------ | ------- | ---------------------------------- | ---------------------------------- | ----- |
| Hiring desk                    | No      | Yes                                | Yes                                | No    |
| Active openings                | —       | 5                                  | 25                                 | —     |
| Applicant email + confirm link | —       | Yes (transactional, company brand) | Yes                                | —     |
| Applicant SMS                  | —       | No                                 | Yes, metered on `smsCommunication` | —     |
| Paid-shadow record             | —       | Yes (phase 2)                      | Yes (phase 2)                      | —     |
| Background-check product       | —       | No                                 | No                                 | —     |

Business is the plan a 2–30 person cleaning company is sold. That is who sits on sixty applications and five arrivals. The desk is an office workflow on top of team invites, the schedule, and payroll export, which are already Business and above. Starter is the small-team fallback (5 field seats, no payroll export). A company that hires often enough to need this desk is already a Business conversation.

An add-on is the wrong v1 package. `plans` / `plan_features` / `tenant_addons` checkout is still unbuilt, so an add-on means a one-off Stripe price and a second thing for sales to explain before any owner has used the desk. The workflow has no per-applicant cost when it runs on email. The costs that vary — text messages, and later a background check — are the add-ons, and they come after the desk is in use.

Pro-only would hide the desk from the companies the sales motion is aimed at. SMS is already Pro because sent.dm has a real marginal cost and the send pipeline is entitled that way (`docs/billing/tier-entitlements.md`). Business runs the same loop by email and a confirm link. A later “Hiring SMS” bundle for Business can wait until add-on checkout exists and Business owners ask for texts.

The free trial stays excluded. Trial workspaces are purged when they never activate, and a 7-day trial is too short to run a real hiring cycle. Applicant names, phones, and emails should not land in a workspace that is about to be deleted.

Hire still consumes a field or office seat through the existing invite path (`assertCanAssignTeamSeat`). Applicants and unpaid holds do not consume seats.

**Later add-ons, not part of this package:**

- Hiring SMS for Business, once add-on checkout exists.
- A background-check pass-through (per check, the tenant pays the screening vendor). v1 does not furnish consumer reports.
- Inbound “reply YES” texts, which depend on two-way SMS. That transport is an explicit non-goal of the sent.dm migration (`docs/integrations/sent-dm-sms-migration.md`).

Proposed entitlement key when this is approved: `hiringDesk` on Business and Pro only. New limit key: `maxActiveHiringOpenings` (5 / 25). No new price.

## Problem

Owners collect a large stack of applications from Indeed, Craigslist, or Facebook, then hold interview time for people who do not come. The waste is the calendar and the delay. Serious applicants are often booked several days out and take another job in the meantime.

The levers that move show-up rate in hourly work:

1. Answer in minutes, not the next time someone opens the inbox.
2. State pay, days, and hard requirements before a slot is offered, so people who will not take the job never get one.
3. Offer a slot today or tomorrow.
4. Require a tap that holds the slot, then remind them the morning of.
5. Prefer a short paid shadow with a lead over an office conversation next week.

Clean Scheduler does not need to be where the sixty applications originate. Indeed already has the applicants. The gap is everything after the application exists.

## What this is

A private hiring desk for one cleaning company:

- The company publishes an opening and shares the link (or pastes it into the Indeed post).
- A person applies on that company’s host. Fixed questions screen them immediately.
- People who pass are offered the soonest slot the office has already published, and must tap a link to keep it.
- The office marks showed, no-show, or not a fit, and a hire becomes the team invite the product already sends.
- Field openings can later record a paid shadow attached to a real visit without creating an employee login.

Each company’s applicants stay inside that tenant. There is no Clean Scheduler job board, no cross-tenant candidate pool, and no listing directory on the marketing site.

## What this is not

- A marketplace, staffing agency, or employer of record. The tenant is the employer.
- A source of applicants. The product does not buy, scrape, or rank outside candidates.
- An applicant tracking system with custom question builders, scorecards, offer letters, or onboarding paperwork.
- Inbound SMS. Confirmation is a link tap in v1 and v2. “Reply YES” waits on two-way SMS.
- A background-check integration. The office attests that a check has been started before an applicant is sent to a customer site. The product does not order or store a consumer report.
- A payroll run for people who are not employees. Shadow hours are a note the office pays outside the product. They do not enter `payroll-export`.
- A field login for applicants. Visit assignees must already be workspace members (`tenant_scheduled_visit_assignees` checks membership). An applicant is never inserted into that table.
- Office-job recruiting as a separate product. An opening may be field or office. Office openings use the same screen, slot, and hire path. Only field openings can record a shadow.

## Claim we can make

Fewer empty slots, and a first answer the same day. The honest numbers on the desk are applicants, screened out, confirmed, showed, and no-show. Marketing must not promise that sixty applicants will become sixty arrivals.

## Roles

| Person                         | What they do                                                                   |
| ------------------------------ | ------------------------------------------------------------------------------ |
| Owner or admin                 | Openings, slots, decisions, hire. Default access.                              |
| Custom role with hiring rights | Same, when Business+ custom roles are granted `hiring.view` / `hiring.manage`. |
| Field employee / lead          | No applicant list in v1. The office tells them who they are meeting.           |
| Applicant                      | No account. Public form and token links only.                                  |
| Viewer                         | No access.                                                                     |

New permission keys, added to `lib/tenant/permissionCatalog.ts` and the Team area in `lib/tenant/permissionAreas.ts`:

- `hiring.view` — openings, pipeline, metrics.
- `hiring.manage` — create openings, publish slots, decide, delete applicant data, start a hire.

Owner and admin receive both. Field and viewer receive neither. Starter never sees the nav item; the upgrade panel used by other Business features applies if a Starter user hits the URL.

## Office flow

1. **Team → Hiring** (new nav item, Business+). Empty state explains the point: publish tomorrow’s slots before sharing the link, or every passer waits on the office.
2. **New opening.** Required: title, kind (`field` or `office`), city or service area shown to applicants, pay text (cannot be empty), days and hours text, and interview kind (`phone`, `office`, or `paid_shadow`). Pay text is what the applicant sees (“$18–$22/hour to start”). The product does not calculate pay.
3. **Questions.** A fixed set of yes/no gates, toggled per opening. The office cannot type their own screening questions in v1 (see Legal). Always on and not removable: “Are you 18 or older?”
4. **Slots.** The office adds concrete starts in the tenant timezone for the next few days: “Tue 7:00am, phone” or “Wed 8:00am, paid shadow, 2 hours, $36.” A slot has a capacity of one. No slot means qualified people sit in **Waiting** and the office gets an email: “N people passed the screen and have nowhere to go.”
5. **Share.** Copy `https://{tenant-slug}.{apex}/apply/{opening-slug}`. The page is `noindex`. It is not linked from the Clean Scheduler marketing site. The company pastes it into their own site or job post.
6. **Queue.** On the opening page, applicants fill the main column, grouped as coming in, waiting for a time, ready to decide, and finished. The application link and interview times sit beside that list on a wide screen, and above it on a narrow one. Pay, days, questions, and closing the role stay in a Role section that is collapsed once the link is live. Primary actions are one tap: mark showed, mark no-show, reject, or hire.
7. **Hire.** Prefills the existing employee invite (`app/tenant/employees/employeeInviteActions.ts`) with name, email, and field or office role. Seat check is unchanged. The applicant row stores the invite id. When the invite is accepted, store the membership user id. If the seat cap blocks the invite, the hire action stops and the applicant stays **showed**.

Manual add exists for someone who applied on Indeed and never hit the link: the office enters name, phone, and email, and the product emails them the same application form. The office cannot skip the form and invent a passing screen. Parsing Indeed emails is out of scope.

## Applicant flow

1. Open the link. See company name, logo, opening title, city, pay, days, and interview kind. No customer names, gate codes, or job-site addresses.
2. Enter name, mobile phone, and email. Answer the yes/no gates. Check a required consent box: this company may email (and, on Pro, text) them about this application only. A honeypot field rejects bots.
3. Submit is rate limited (see Limits).
4. **Screen fail** (any required gate is “no,” including under 18). Status `screened_out`. Email a short thanks that names the requirement they missed. No slot. The office can override to `ready`.
5. **Screen pass** and a future slot is open. Immediately email the soonest slot and a confirm link. Status `slot_offered`. Hold expires after the confirm window (default 3 hours, opening setting, clamped to 30 minutes–24 hours). If the slot starts sooner than that, the hold ends 30 minutes before the start. Expiry returns the slot to the pool and emails the next `ready` person, if any.
6. **Screen pass** and no slot is open. Status `ready`. Email: the company will send a time. Email the office the waiting count.
7. **Confirm tap.** Status `confirmed`. The page repeats when, how (phone / office address the office typed / shadow meeting point), how long, and what they will be paid for a shadow. It does not reveal a customer address unless the office explicitly typed that meeting point, and only after the shadow safety checks in phase 2.
8. **Decline** or ignore. Status `declined` or `offer_expired`. The slot is released.
9. **Morning of.** Email (and Pro SMS) the same confirm page. Quiet hours: do not send the reminder before 7:00 in the tenant timezone.
10. After the start time, the row stays `confirmed` until the office taps showed or no-show. The queue badges **Time passed**. Nothing is auto-marked no-show. Unmarked rows older than 24 hours stay in an **Unresolved** count so metrics do not invent a show rate.

Duplicate submit on the same opening (same normalized email or E.164 phone) updates the existing row instead of creating a second one, unless that row is already `hired`. The same person may apply to a second opening; the office sees “Also applied to {other title}.”

## Slot engine

This is the part that addresses the no-show. Everything else is a list.

- Slots are created by the office before, or while, applications arrive. The product never invents a time.
- A qualified applicant is matched only to a slot on that opening whose start is still in the future and whose hold is empty.
- Matching picks the earliest start.
- One hold at a time per applicant per opening.
- Confirm is `GET` of an unguessable token, then a button that `POST`s so mail-prefetch cannot confirm. Token is stored hashed. Confirm and decline both work signed out.
- Releasing a hold (expiry, decline, office cancel) offers that slot to the oldest `ready` applicant, then to the oldest `offer_expired` applicant who has not been rejected. It does not re-offer someone who declined or no-showed that opening.
- The office can cancel a confirmed slot. The applicant is emailed, and the status returns to `ready`.
- Phone and office interviews need a meeting detail the office writes (phone number to expect, or a street address). Paid shadow meeting details are phase 2. Phase 1 may still use interview kind `paid_shadow` as a label on the slot, with the meeting detail typed by hand, and without the visit link or safety gates.

## Paid shadow (phase 2)

A shadow is a record on the applicant, optionally linked to an existing `tenant_scheduled_visits` row. It does not add the applicant as an assignee, does not create a membership, and does not write payroll.

Fields:

- Visit id, optional. The visit’s assigned members are the crew already on that job.
- Accompanied by: a required workspace member (the lead).
- Meeting point: free text. Default empty. Never copied from the customer property.
- Customer site: boolean, default false. Turning it on requires both “background check started” (office attestation, timestamp, member id) and an accompanied-by member. The product stores the attestation, not a report.
- Agreed duration and agreed pay text or cents. The office pays this outside Clean Scheduler.
- Outcome: completed, applicant no-show, company canceled. Completed hours stay on the applicant row so the office can pay them. They are excluded from payroll export and from employee performance reports.

The lead’s visit page, in v1 of this phase, does not show the applicant’s phone or email. A single line the office chooses to copy onto the visit’s job notes is enough (“Shadow: Alex, meet at the shop at 7:45”). Automatic notes can wait.

Copy on the shadow form: the company is responsible for paying the time, for insurance, and for not sending someone into a home alone before their own screening process says it is okay. Clean Scheduler is the record, not the employer.

## Pipeline

| Status          | Meaning                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------- |
| `ready`         | Passed the screen. No slot held.                                                              |
| `screened_out`  | Failed a required gate. Office may override to `ready`.                                       |
| `slot_offered`  | Hold placed. Confirm link outstanding.                                                        |
| `confirmed`     | Applicant tapped confirm.                                                                     |
| `offer_expired` | Hold lapsed. Eligible for a later offer.                                                      |
| `declined`      | Applicant declined. Not re-offered on this opening.                                           |
| `showed`        | Office marked arrival.                                                                        |
| `no_show`       | Office marked no-show. Not re-offered on this opening.                                        |
| `rejected`      | Office passed. Terminal.                                                                      |
| `hired`         | Invite created. Terminal even if the invite later expires.                                    |
| `withdrawn`     | Applicant used the withdraw link, or the office deleted the application and kept a tombstone. |

Opening status: `draft`, `open`, `closed`. Only `open` accepts applications. Closing an opening releases unconfirmed holds and emails confirmed people that the interview is canceled. Drafts are not on the public URL.

## Data model (proposed)

Tenant-scoped. RLS follows existing tenant isolation: members with `hiring.view` read; public insert goes through a server action using the service role after slug lookup, never a world-readable table grant.

`tenant_hiring_openings`

- `id`, `tenant_id`, `slug` unique per tenant, `title`, `kind` (`field` \| `office`), `status`
- `pay_text`, `schedule_text`, `area_text` (all required when status becomes `open`)
- `interview_kind` (`phone` \| `office` \| `paid_shadow`)
- `confirm_window_minutes` default 180
- question toggles (booleans, see Legal)
- `closed_at`, timestamps

`tenant_hiring_slots`

- `id`, `tenant_id`, `opening_id`, `starts_at`, `duration_minutes`
- `meeting_text` (office-written)
- `shadow_pay_cents` nullable, `shadow_visit_id` nullable (phase 2)
- `held_by_application_id` nullable

`tenant_hiring_applications`

- `id`, `tenant_id`, `opening_id`
- `full_name`, `email`, `phone_e164`
- `status`, gate answers (json of the fixed keys only)
- `consent_at`, `consent_version`
- `source` (`public_form` \| `office_link`)
- `invite_id` nullable, `hired_user_id` nullable
- `screened_out_reason` nullable
- unique `(opening_id, email)` and unique `(opening_id, phone_e164)`

`tenant_hiring_events`

- Append-only: offered, confirmed, expired, reminded, showed, no-show, hired, deleted. Actor is a member id or `system`.

`tenant_hiring_tokens`

- Hashed token, purpose (`confirm` \| `decline` \| `withdraw`), `expires_at`, `used_at`.

Phase 2 columns on the application or a child `tenant_hiring_shadows` row: visit id, accompanied-by user id, meeting point, `customer_site`, `background_check_attested_at`, `background_check_attested_by`, outcome, agreed pay.

Do not add applicants to `tenant_scheduled_visit_assignees`.

Deletion: office action **Delete applicant data** nulls name, email, and phone, keeps status and event timestamps, and removes tokens. Closing a tenant (existing purge) deletes these rows with the tenant. There is no separate applicant login to erase.

## Email and SMS

Applicant mail uses the cleaning company’s brand, reply-to, and transactional shell (`docs/product/email-branding.md`). It is not a campaign and does not decrement `includedEmailCreditsMonthly` or campaign send quotas. Messages:

- Screened out
- Slot offered (confirm link)
- Confirmed
- Morning reminder
- Hold expired
- Slot canceled by the office
- Office notified when someone is `ready` and no slot exists (this one is Clean Scheduler product mail to the office, same pattern as other staff alerts)

Pro SMS uses `sendTransactionalSms`, new `SmsPurpose` values, and approved sent.dm templates. Each send counts segments against `includedSmsCreditsMonthly`. No SMS until the template ids exist in the environment. Business with `hiringDesk` and without `smsCommunication` skips SMS silently and still sends email. Suggested purposes: `hiring_slot_offered`, `hiring_reminder`, `hiring_slot_canceled`. Screened-out stays email-only so a rejection is not a text.

SMS consent is the checkbox on the form, stored with a version string. No checkbox, no phone persist, no send. Hiring SMS is off during trial because the desk is off, and off unless billing status is `active` or `past_due`, matching `canUseSmsCommunication`.

Inbound SMS is not part of this plan. A YES reply would not be read.

## Public surface and abuse

- Route on the tenant host, same idea as `/book`: `/apply/{opening-slug}`.
- `noindex, nofollow`. Omitted from sitemap and from platform SEO.
- Slug is chosen by the office, unique per tenant, editable only while `draft`.
- Rate limit: 5 submits per IP per opening per hour, 30 submits per IP per tenant per day. Office manual-add is not in that bucket.
- Honeypot plus a minimum fill time (for example, reject submits faster than 2 seconds).
- Confirm tokens are 32 bytes, stored as a hash, single purpose, expired with the hold.
- Public pages never query across tenants and never list openings other than the one in the URL.
- Application rows are not in the customer portal, the marketing CMS leads inbox, or exports except a hiring CSV for `hiring.manage` (name, phone, email, status, opening). That CSV is easy to leak; gate it on `hiring.manage` and log the download on `tenant_hiring_events`.

## Legal and safety

This section is product constraint, not a legal opinion. Counsel should review the question set and the consent line before launch.

- The tenant is the employer. Empty-state and hire copy say so. Clean Scheduler does not place workers and does not take a placement fee.
- Pay text and schedule text are required before an opening can go `open`, so the public page always shows pay and days.
- Screening questions are a fixed set the office can turn off, except age. v1 keys:
  - `age_18` — always required.
  - `transportation` — default on for field, off for office.
  - `accepts_pay` — default on.
  - `accepts_schedule` — default on.
  - `background_check_willing` — default on for field, off for office.
  - `work_authorized` — default off, because employment-authorization questions are easy to misuse. Office may turn it on.
- No free-text employer questions in v1. No fields for race, gender, religion, disability, pregnancy, national origin, or age beyond the 18+ gate.
- One optional applicant note (“Anything we should know?”) is stored and shown to the office. It is not scored.
- Background-check attestation is a checkbox that a named member clicked. The product must not collect a report, SSN, or date of birth in v1. Ordering checks would make Clean Scheduler a consumer-reporting flow and is an add-on only with a vendor agreement.
- Customer addresses, alarm codes, and customer names stay off the applicant page unless an office user types them into the meeting-point field. The shadow form warns before save when the text looks like it will be shown to the applicant.
- A customer-site shadow cannot be saved until “background check started” is attested and an accompanying member is set.
- Shadow pay is a record. The product does not transfer money to the applicant, does not 1099 them, and does not put the hours on payroll export.
- Consent copy is versioned. Withdrawing (token link in every applicant email) sets `withdrawn` and runs the same PII null-out as office delete.
- SMS, when sent, is about this application only. No hiring marketing blasts.

## Metrics

On the opening, for the office:

- Applicants (all submits)
- Screened out
- Confirmed
- Showed
- No-show
- Unresolved (confirmed, start time passed, still unmarked)
- Hired

Show-up rate is **showed ÷ confirmed**, displayed only when confirmed is at least 5. Also show **showed ÷ applicants** so the owner can see the funnel they actually feel. No leaderboard across tenants. No public “response time” badge in v1.

## Limits and entitlement enforcement

- `assertFeatureEnabled(tier, 'hiringDesk')` on office actions and on turning an opening `open`.
- Public submit on a Starter or trialing tenant returns a generic unavailable page. The form is not rendered.
- Active openings: status `open` counts toward `maxActiveHiringOpenings`. Draft and closed do not.
- Past_due Pro still follows the SMS rule already used for quotes and visit reminders.
- Email failures do not roll back the status change. The office row shows “mail failed” from the event log so they can resend the confirm link.

## Phases

### Phase 1 — Desk and slots

**Implemented.** Office openings and slots, the public apply link, email confirm, the morning email reminder, queue actions, hire into the existing team invite, metrics, RLS, rate limit, delete, and the `hiringDesk` entitlement. Paid shadow is a label plus the meeting line the office types. No visit link, no SMS, and no Indeed inbox parsing. Apply migration `0115_hiring_desk.sql`.

Acceptance:

- A Business workspace can open a field role, publish two slots tomorrow, and copy a link.
- A passer who accepts pay and schedule receives the earlier slot within the same request’s follow-up email.
- A fail on transportation gets the screened-out email and no slot.
- An unconfirmed hold returns to the pool at the window and is offered to the next `ready` applicant.
- Confirm requires the button POST. Prefetch does not confirm.
- Showed → Hire runs the existing seat check and creates a normal pending invite.
- A Starter workspace and a trialing workspace cannot open the desk or submit the form.
- Applicant pages send `noindex` and do not appear on the marketing sitemap.
- A second Business tenant cannot read the first tenant’s applications (RLS test alongside existing tenant isolation).

### Phase 2 — Shadow record

Visit link, accompanied-by, customer-site gate, background-check attestation, agreed pay, outcome. Still no assignee row and no payroll line.

Acceptance:

- Saving a customer-site shadow without attestation or an accompanying member is rejected.
- The customer property address is not copied into `meeting_text`.
- Payroll export for that week does not include the applicant.
- The visit assignee list is unchanged.

### Phase 3 — Pro SMS

Three templates, credit metering, consent already collected in phase 1. Email remains the source of truth; SMS is an additional nudge.

Acceptance:

- Business sends no hiring SMS.
- Pro over the monthly segment cap fails the SMS send and still sends email.
- Templates are the only body. No freeform hiring text.

### Not scheduled

Inbound SMS confirm, Indeed inbox parsing, Checkr or equivalent, a Business SMS add-on, applicant mobile app, cross-tenant talent pool, custom question builder, auto no-show, and putting shadows on payroll.

## Decisions to confirm before implementation

1. **Package.** Business and Pro included, Starter excluded, trial excluded, SMS remains Pro. This is the recommendation above.
2. **Phase 1 cut.** Slots, email confirm, and hire handoff first. Shadow safety gates in phase 2. SMS in phase 3.
3. **Fixed questions only**, with `work_authorized` defaulting off.
4. **Caps.** 5 active openings on Business, 25 on Pro.
5. **Counsel review** of the consent sentence and the question list before the public form is enabled in production.

## Implementation notes (for later, not now)

Likely touch points once approved. Do not start these in the review pass.

- Entitlement: `lib/billing/entitlements.ts`, `docs/billing/tier-entitlements.md`, marketing plan comparison if the public pricing page lists Business features.
- Permissions: `lib/tenant/permissionCatalog.ts`, `lib/tenant/permissionAreas.ts`, nav in `lib/tenant/loadTenantNavItems.ts`.
- Migration for the tables above, plus an RLS smoke script next to `supabase/tests/rls/`.
- Public route beside `app/book/`.
- Office UI under `app/tenant/hiring/`.
- Mail beside existing transactional senders. SMS purposes beside `lib/sms/sendTransactionalSms.ts`.
- Hire calls into `app/tenant/employees/employeeInviteActions.ts` rather than a second invite writer.
- Cron for hold expiry and morning reminders, same shape as `/api/cron/visit-reminders`.
