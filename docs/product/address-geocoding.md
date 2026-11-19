# Address geocoding

Every service location (`tenant_customer_properties`) stores a map point when a US address can be resolved. Routing reads that point later. This is included for every plan. There is no paid geocoding add-on.

Apply migration **`0129_property_geocode_metadata.sql` by hand** before deploying the app that writes these columns. Agents and CI do not apply it.

## What is stored

On `tenant_customer_properties`, next to `latitude` and `longitude`:

| Column             | Meaning                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geocode_status`   | `pending` while a lookup is in flight or waiting to retry after an outage, `ok` when a point was stored, `failed` when the address itself did not match |
| `geocode_source`   | `census` or `geocodio`. Empty on older points and on failures                                                                                           |
| `geocode_accuracy` | Match quality from the provider, such as `interpolated:L` or `rooftop`                                                                                  |
| `geocoded_at`      | When that finished lookup was stored                                                                                                                    |
| `geocode_reason`   | Why there is no point (`no_match`, `incomplete`, `outside_us`, `lookup_failed`, and older Google reasons)                                               |

The new columns sit on the existing table. Row access stays the member read and write policies (`tenant_customer_properties_member_read` and `tenant_customer_properties_member_write`). No new grant is added.

## Providers

1. US Census Bureau geocoder (`https://geocoding.geo.census.gov`). No API key.
2. Geocodio, only when `GEOCODIO_API_KEY` is set to a non-blank value **and** Census did not return a point.

Google and Mapbox are not called. Their terms forbid storing geocode results.

`GEOCODIO_API_KEY` is server-only. It is documented in `.env.example`. Do not prefix it with `NEXT_PUBLIC_`. Leave it unset to stay on Census alone. The app reads `process.env.GEOCODIO_API_KEY` and does not ship a secret.

## When a lookup runs

- Creating or editing a service location saves the address first. The lookup runs after that write. A timeout, a miss, or a thrown error updates the geocode columns when it can, and it does not roll back the customer or the address.
- An unchanged address that already has a point, or a real miss, is not sent to the provider again. An outage waits 60 seconds, then the next save tries again.
- Changing the street, city, state, or postal code clears the old point, marks the row `pending`, and looks the new address up.
- The office shows **Couldn't locate this address** when the reason is `no_match`. That miss stays until the address text changes.
- A provider outage (`lookup_failed`) stays `pending`. The card says **Lookup will retry**. A later save, Fill schedule, and the backfill try again after 60 seconds. They do not need `--retry-failed`. `--retry-failed` is only for a real miss.

Home addresses and the business address still store a point and a reason. They do not yet store source, accuracy, and timestamp. Those columns are only on the service location, which is where a job happens.

## Backfill

Existing locations with no point are filled one workspace at a time. The script is rate-limited (at least 200 ms between lookups, 1100 ms by default) and only reads that tenant. A second run skips points and real misses. An outage is tried again after 60 seconds without `--retry-failed`. `--retry-failed` looks up a real miss again.

```bash
node --env-file=.env.local --import ./scripts/local-stack/register-ts-extensions.mjs scripts/backfill-property-geocodes.mts --tenant <workspace-uuid>
```

Optional flags: `--min-interval-ms 1100`, `--retry-failed`.

Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the environment. The command prints counts only. It does not print addresses or the key.

`npm run geocode:backfill -- --tenant <workspace-uuid>` is the same script. Pass `--env-file=.env.local` yourself when the variables are not already exported, because the npm script does not load an env file.

Local QA does not call Census or Geocodio. `npm run test:local-stack` points the lookup at a loopback stub (`CENSUS_GEOCODE_URL` on `127.0.0.1` only). An address containing "outage" stays pending ("Lookup will retry"). An address containing "nomatch" is stored as a miss ("Couldn't locate this address"). Any other override host is ignored and Census stays the provider.
