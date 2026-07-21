# Service zones — product & implementation

Tenant-managed **service zones** organize customer locations by community or area (for example “Babcock Ranch”). Available on **all plans**. Separate from **Locations** (Pro), which tag visits and invoices by crew or branch.

## Surfaces

| Surface            | Route                     | Behavior                                                                     |
| ------------------ | ------------------------- | ---------------------------------------------------------------------------- |
| Settings           | `/settings/service-zones` | Owners/admins create, rename, activate/deactivate, and delete unused zones   |
| Settings hub       | `/settings`               | Card under “Your workspace” with active zone count                           |
| Customer create    | `/customers/new`          | Optional zone on the primary service location                                |
| Customer detail    | `/customers/[id]`         | Zone select on each service location                                         |
| Customer directory | `/customers`              | Filter dropdown + text search matches zone names; primary zone shown on rows |

## Data model

Migration **`0088_service_zones.sql`**:

- `tenant_service_zones` — `name`, `is_active`, `sort_order`; unique `(tenant_id, lower(name))`
- `tenant_customer_properties.service_zone_id` — nullable FK, `on delete set null`

Single zone per property. Multi-site customers can use different zones per location.

## Lifecycle

- **Create / rename** — admin settings; duplicate names rejected
- **Deactivate** — hidden from new assignments; existing assignments kept (shown as inactive in selects)
- **Delete** — only when no properties reference the zone; otherwise clear or reassign first

## Implementation notes

- Helpers: [`lib/tenant/serviceZones.ts`](../../lib/tenant/serviceZones.ts)
- Directory fetch/search: [`lib/tenant/customerDirectoryFetch.ts`](../../lib/tenant/customerDirectoryFetch.ts)
- Settings CRUD mirrors Locations UX without a plan gate

## Out of scope (v1)

Multi-zone per property, map/ZIP auto-assign, schedule filtering by zone, campaign targeting by zone.
