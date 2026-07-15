# Public booking request form

**Status:** Shipped (MVP)  
**Tier:** All plans (`publicBookingRequest`)  
**Migration:** `0084_public_booking_request.sql`

## What it is

A lite public **quote / booking request** form at `https://{tenant-slug}.{apex}/book` (also `/request`). Submissions create `tenant_marketing_leads` rows with `source = quote_request` and email the office.

This is **not** instant calendar booking, an embeddable pricing widget, or the full marketing CMS.

## Tenant setup

1. Settings → **Booking requests** — copy the public URL; toggle form live
2. Settings → **Leads** — review submissions (same inbox as CMS contact forms)

## Key files

| Layer         | Path                                                                      |
| ------------- | ------------------------------------------------------------------------- |
| Public page   | `app/book/page.tsx`                                                       |
| Submit action | `app/book/actions.ts`                                                     |
| Proxy routing | `proxy.ts` (`/book` on tenant host → `kind: site`)                        |
| Settings      | `app/tenant/settings/booking-requests/`                                   |
| Leads         | `app/tenant/settings/website/leads/page.tsx` (ungated for booking OR CMS) |

## Out of scope

Embeddable iframe widget, bedroom/bath pricing calculator, auto-scheduling onto visits, custom domain for the lite form alone (use CMS unified domain on Pro for branding elsewhere).
