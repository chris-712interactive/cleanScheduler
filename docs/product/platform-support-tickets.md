# Platform support tickets

Tenants contact **Clean Scheduler** (the platform) about billing, bugs, or account issues. This is separate from tenant↔customer messaging ([customer-support-messaging.md](./customer-support-messaging.md)).

## Surfaces

| Portal                | Route               | Who                                                   |
| --------------------- | ------------------- | ----------------------------------------------------- |
| Founder admin         | `/support`          | Platform admins — inbox, reply, assign, resolve/close |
| Tenant                | `/settings/support` | Owner and admin — create tickets, reply               |
| Founder tenant detail | `/tenants/[slug]`   | Recent tickets for that workspace                     |

## Schema (migration **0073**)

- `platform_support_tickets` — subject, status, category, tenant, assignee
- `platform_support_messages` — transcript with `author_side` (`tenant` | `platform`)

Statuses: `open`, `waiting_on_tenant`, `waiting_on_platform`, `resolved`, `closed`.

## Key files

- `lib/admin/loadPlatformSupportInbox.ts`, `loadPlatformSupportTicketDetail.ts`
- `lib/admin/platformSupportActions.ts`
- `lib/tenant/loadTenantPlatformSupportTickets.ts`
- `app/admin/support/`, `app/tenant/settings/support/`
- Inbox chrome is `app/tenant/messages/support-messages.module.scss`, shared with tenant Messages. Ticket rows stay a vertical stack inside `.threadButton`.

## Follow-ups

- Email founder ops on new tenant message
- Link from marketing `/help/contact` for logged-in tenants
