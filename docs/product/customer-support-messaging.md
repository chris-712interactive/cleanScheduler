# Customer support messaging — product & implementation

Two-way in-app messaging between customers and tenant staff. Uses the **`0013`** schema (`customer_support_threads`, `customer_support_messages`). No new migration in v1.

## Scope (v1 — PR #115)

| Surface | Route | Capabilities |
| ------- | ----- | ------------ |
| Customer portal | `/messages`, `/messages/[id]` | Start thread, list threads, reply on **open** threads |
| Tenant portal | `/messages` | Split-pane inbox, reply, close/reopen, filters (open/closed/all) |
| Customer detail | `/customers/[id]` | **Messages (N)** link → `/messages?customer=<id>&filter=open` |

**Not in v1:** email/SMS notifications when a message arrives; founder-admin ticketing (`phase2Tickets`); SMS two-way inbox (`phase2Twilio` cancelled — sent.dm is transactional only).

## Roles (tenant)

| Role | View inbox | Reply | Close / reopen |
| ---- | ---------- | ----- | -------------- |
| Owner | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes |
| Employee | Yes | Yes | Yes |
| Viewer | Yes | No | No |

Access helper: `lib/tenant/supportMessagingAccess.ts` → `canReplyToSupportThreads`.

## UX notes

- **Tenant desktop:** ~240–320px thread list + conversation pane; maximizes transcript space.
- **Tenant mobile:** list by default; `?thread=<uuid>` shows conversation full-screen.
- **Nav badge:** count of **open** threads (`lib/tenant/openSupportThreadCount.ts`, cached via `getCachedOpenSupportThreadCount`).
- **Closed threads:** customer sees note to start a new message; tenant can reopen.

## Key files

| Path | Purpose |
| ---- | ------- |
| `app/tenant/messages/` | Tenant inbox page, list, conversation, server actions |
| `app/customer/messages/` | Customer list, thread detail, create + reply actions |
| `components/messaging/SupportMessageTranscript.tsx` | Shared transcript UI |
| `lib/tenant/loadTenantSupportInbox.ts` | Inbox query + filters |
| `lib/tenant/loadSupportThreadDetail.ts` | Thread + messages for tenant or customer |
| `lib/tenant/buildTenantNavItems.ts` | Messages nav item + badge |

## Follow-ups (backlog)

- Notify staff by email when a customer sends or replies
- Optional “awaiting reply” badge semantics (today: open thread count)
- Public help article under `/help/customers` (screenshots)
