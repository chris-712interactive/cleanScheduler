# GPS-verified check-in

**Status:** Shipped (MVP)  
**Tier:** Business+, free trial (`gpsVerifiedCheckIn`)  
**Migration:** `0082_visit_gps_checkin.sql`

## What it is

Point-in-time **arrival location proof** when a crew member checks in to a scheduled visit (or when office completes a visit that still needs check-in). The browser asks for location once; we store latitude, longitude, accuracy, and a status on `tenant_scheduled_visits`.

Office staff see the result on visit detail (coordinates + Google Maps link when captured, or a short reason when permission was denied / unavailable).

## What it is not

- Live / continuous GPS tracking of crews
- Geofenced hard-block (check-in still works if location is denied)
- Route optimization or a native cleaner app

## Flow

1. Entitled tenant → field UI requests `navigator.geolocation.getCurrentPosition`
2. Form posts `check_in_location_status` (+ lat/lng/accuracy when captured)
3. Server parses/validates (`lib/schedule/checkInLocation.ts`) and updates the visit only if `gpsVerifiedCheckIn` is enabled
4. Visit detail aside shows **Check-in location** proof

## Key files

| Layer                        | Path                                                |
| ---------------------------- | --------------------------------------------------- |
| Client capture               | `lib/schedule/captureDeviceLocation.ts`             |
| Parse / format               | `lib/schedule/checkInLocation.ts`                   |
| Check-in UI                  | `app/tenant/schedule/VisitFieldWorkPanel.tsx`       |
| Complete (backfill check-in) | `app/tenant/schedule/CompleteVisitPaymentModal.tsx` |
| Server actions               | `app/tenant/schedule/visitFieldActions.ts`          |
| Office proof UI              | `app/tenant/schedule/VisitDetailCard.tsx`           |

## Follow-ups (not in MVP)

- Property geocoding + soft geofence distance (`check_in_distance_m`)
- Optional hard-block outside radius (Pro)
- Location stamp on complete even when already checked in
- Native apps / background tracking (long-term)
