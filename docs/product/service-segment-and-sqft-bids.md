# Service segment and commercial square-foot bids

Each workspace chooses the cleaning work it sells: residential, commercial, or both. The choice is stored on `tenant_operational_settings.service_segment` (`0119_tenant_service_segment_sqft_bids.sql`). Existing workspaces default to `both`, so current homes, offices, quotes, and visits stay available until an owner narrows the setting.

## Where it is set

- Trial signup asks **Services you offer** and writes the same value onto operational settings. The onboarding profile still keeps the free-text `business_type` for founder review.
- Owners and admins change it later under **Settings → Business → Residential, commercial, or both**.

## One capability helper

`capabilitiesForSegment` in `lib/tenant/serviceSegment.ts` is the only place that decides what a segment may see. Client screens use `useTenantSegmentCapabilities`. Server creates and updates call `propertyKindWriteError`, `sqftBidAllowedForProperty`, and `bookingServiceAllowed`.

| Segment     | Shown                                                                                                                          | Hidden                                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Residential | Homes, short-term rentals, beds and baths, home add-ons, home booking presets, residential route preset                        | Commercial property type, square-foot bids, office scope template, janitorial booking preset, commercial schedule preset |
| Commercial  | Commercial sites, cleanable square feet, square-foot bids, office scope, janitorial booking preset, commercial schedule preset | Beds and baths, home add-ons, maid-style booking presets, residential route preset                                       |
| Both        | Both lines, with a home or building badge and separate customer tabs                                                           | Nothing from either line                                                                                                 |

`other` stays available on every segment as a neutral property type. A location that was saved before the workspace narrowed its segment can still be updated, but a new location of the other line is rejected. Customer import skips properties outside the segment instead of relabeling them.

## Where the segment is enforced

- Customer locations, quote property type, schedule location picker, job types, crew property skills, consultation questions, and the customer portal location request.
- Public `/book` service list. A posted service that the segment does not offer is rejected. Instant online booking (a separate booking-mode setting) should keep calling `bookingServiceAllowed` and `capabilitiesForSegment` rather than adding a second copy of these lists.
- Reports stay one set of financial totals. The reports page says so. Mixed workspaces get Residential and Commercial tabs on the customer directory and a service-line filter on the schedule. Schedule cards use a green accent for homes and a blue accent for commercial sites.

## Square-foot bids

`pricing_method = per_sqft` now computes the line amount. The office enters cents per square foot. Square feet come from the line, or from the quote property snapshot, or from `tenant_customer_properties.sqft`.

- One-time: amount = rate × sq ft.
- Weekly: monthly contract = rate × sq ft × (52 / 12).
- Every two weeks: half of that weekly visit count.
- Monthly: one visit, unless times per month is set.
- Custom: requires times per week or times per month. Times per week also uses 52 / 12.
- Optional production rate stores labor hours as sq ft ÷ sq ft per hour on `estimated_hours`.

`amount_cents` remains the list price that discounts and tax already use. The rate, square feet, visit count, period (`visit` or `month`), and production rate are stored on the line and copied into the acceptance snapshot. The quote page and the customer quote show that breakdown.

Square-foot pricing is rejected unless the workspace offers commercial work and the property is commercial. Flat and hourly lines are unchanged.
