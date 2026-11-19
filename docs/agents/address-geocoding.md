# Address geocoding (T1)

Session notes for the service-location geocode foundation. Product behavior is in `docs/product/address-geocoding.md`.

## Decisions

- Job locations are `tenant_customer_properties`. Latitude and longitude were already there (`0101`) with `geocode_reason` (`0109`). Migration `0129` adds `geocode_status`, `geocode_source`, `geocode_accuracy`, and `geocoded_at` on that table only. Home and office points still use the older columns.
- Do not apply `0129` from an agent or from CI. The owner applies SQL by hand.
- Provider interface is `GeocodeProvider` in `lib/geo/geocodeProvider.ts`. `lookupUsAddress` calls Census, then Geocodio only when `GEOCODIO_API_KEY` is non-blank and Census did not match. Google's client remains as a response parser in `lib/geo/googleGeocode.ts` and is not called. Do not store Google or Mapbox results.
- Saves write the address (status `pending` when there is text) before `savePropertyGeocode`. That helper never throws. The address match on the update keeps a slow lookup from writing a point onto an address that has since changed.
- Unchanged text with a point, or with `geocode_status` of `ok` or `failed`, or with `geocoded_at`, does not call the network. Pending and legacy rows with no point do.
- Backfill lives in `lib/geo/backfillPropertyGeocodes.ts` and `scripts/backfill-property-geocodes.mts`. It requires `--tenant`. Default interval is 1100 ms and is clamped to 200–10000. Failures are stored and skipped on the next run unless `--retry-failed`.
- The office badge on the service location uses "Couldn't locate this address" for `no_match` and `lookup_failed` (`couldNotLocateAddress`).

## Tests

`lib/geo/geocodeProviders.test.ts` uses `lib/geo/fixtures/*.json`. No live geocoder calls. `lib/geo/backfillPropertyGeocodes.test.ts` covers a second run that does not call the provider.

## Not done here

- Map view, stop ordering, multi-cleaner dispatch, and entitlements (T2–T6).
- Manual pin placement.
- Source, accuracy, and timestamp on employee homes and the business address.
- Hosted-dev browser pass. CI does not run Playwright or a production build.
