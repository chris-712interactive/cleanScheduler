# Mileage tracking

**Status:** Shipped  
**Migration:** `0118_mileage_tracking.sql`  
**Plans:** Log, personal week, and CSV on every plan. Dollar amount follows a tenant switch. Drive cost on a visit uses job costing (Business and Pro).

## What people do

Field employees and admins confirm one day of drives. The schedule suggests stops from assigned visits. An event, estimate, or supply run is a stop they add. **Looks right** confirms the day. The office approves it from **Miles** and can export a CSV. Payroll export stays an hours file.

Review lives at `/schedule/miles`, which field employees can open. Their nav stays Schedule, Time off, and Account. The schedule day shows a review link, and a yesterday link when that day still needs a confirm. The team week is `/mileage`.

## Tenant switches

Settings → Operations. Both default off.

| Setting                   | Default | Effect                                                                                                                     |
| ------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------- |
| Calculate a reimbursement | Off     | On shows a dollars-per-mile rate. Personal cars get an amount. A company van stays at $0. Off means the log is miles only. |
| Ask for odometer          | Off     | On adds start and end. The day can still be confirmed with them empty.                                                     |
| Home to first job         | Off     | Commute                                                                                                                    |
| Last job to home          | Off     | Drive home                                                                                                                 |
| Between stops             | On      | Jobs, supplies, events                                                                                                     |
| Office legs               | On      | Drives that start or end at the office                                                                                     |

The odometer difference is the vehicle total. It is compared with every trip on the list, including ones left off the pay rules. A gap is a stop to add. It does not replace the trips.

## Where a mile comes from

1. Miles this account already confirmed for the same two places.
2. A hosted OpenStreetMap route when `OSRM_BASE_URL` is set. The leg is labeled Suggested.
3. A number the person types. **Open in Maps** opens the drive and does not send a distance back.

Coordinates already come from Google geocoding when a key is set, and from the US Census geocoder otherwise. A straight-line distance is never stored as the drive.

A check-in far from the property (about 500 meters) is a flag on that stop. The stop stays at the job address.

## Permissions

`mileage.log` for your own days (field employees). `mileage.review` for the team week, approve, and CSV. `mileage.manage_settings` for the switches. Owners and admins also pass on role when a permission row is missing.

## Notes for later sessions

- Apply migration **0118** before the screens can save. New tenants get the permission keys from `seed_tenant_system_roles_for_tenant`.
- Field route allowlist in `lib/tenant/fieldEmployeeAccess.ts` includes `/schedule/miles` only. Do not hang the team week under that path.
- Mileage tables are service-role only, same pattern as other operational tables.
- `OSRM_BASE_URL` is optional. Without it, unsaved pairs stay blank until someone types the miles or a saved pair exists.
- Confirming a day writes `tenant_mileage_segments` so the next identical drive is suggested from this account, not from a map API.
