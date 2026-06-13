# Custom roles and permissions

**Status:** Shipped (Bucket B3, migration `0075_tenant_custom_roles.sql`)

Business+ workspaces (`rolePermissions` entitlement) can define custom roles at `/settings/roles`. The UI groups permissions into product areas (Quotes, Billing, Team, etc.) with plain-language summaries — not raw keys like `quotes.manage`.

## Data model

| Table                        | Purpose                                                                |
| ---------------------------- | ---------------------------------------------------------------------- |
| `tenant_roles`               | Per-tenant role definitions (`name`, `slug`, `base_role`, `is_system`) |
| `tenant_role_permissions`    | `(role_id, permission_key)` grants                                     |
| `tenant_memberships.role_id` | Links a member to their role row                                       |

Four **system roles** (Owner, Admin, Field employee, Viewer) are seeded for every tenant. Custom roles clone a `base_role` template for seat counting and JWT `tenant_role` claims.

A trigger keeps `tenant_memberships.role` (enum) in sync with the assigned role’s `base_role` so existing RLS and auth claims continue to work.

## Permission catalog

Canonical keys live in `lib/tenant/permissionCatalog.ts` (e.g. `quotes.manage`, `team.invite`, `messages.reply`).

Resolve grants with:

- `resolveMembershipPermissions(admin, membership)` → `Set<PermissionKey>`
- `hasPermission(permissions, key)` / `assertPermission(permissions, key)`

## UI and actions

- Settings: `app/tenant/settings/roles/` — list, create, edit, delete custom roles
- Permission areas: `lib/tenant/permissionAreas.ts` — browse summaries + edit presets per area
- Server actions: `app/tenant/settings/roles/actions.ts` (gated by `team.manage_roles`)

## Enforcement (MVP)

Permissions are enforced in server actions first; RLS still uses membership + `base_role`.

Wired paths:

- Team invites / member changes → `team.invite`, `team.manage_members`
- Quote status moves → `quotes.manage`
- Customer message replies → `messages.reply`
- Sidebar nav visibility → view permissions per route (`buildTenantNavItems.ts`)

## Entitlement

`rolePermissions` on **Business** tier and above (and trial). Starter sees built-in role documentation only.
