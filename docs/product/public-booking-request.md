# Public booking request form

**Status:** Shipped (MVP)  
**Tier:** All plans (`publicBookingRequest`)  
**Migration:** `0084_public_booking_request.sql`

## What it is

A lite public **quote / booking request** form at `https://{tenant-slug}.{apex}/book` (also `/request`). Submissions create `tenant_marketing_leads` rows with `source = quote_request` and email the office.

This is **not** the only public booking mode. Settings → Online booking can turn the page off or switch it to instant self-booking. See `docs/product/instant-online-booking.md`.

## Tenant setup

1. Settings → **Online booking** — choose Off, Request only, or Instant booking
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
