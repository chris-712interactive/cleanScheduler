# Customer support messaging — product & implementation

Two-way in-app messaging between customers and tenant staff. Uses the **`0013`** schema (`customer_support_threads`, `customer_support_messages`). Migration **`0072`** adds the staff email notification ops flag. Migration **`0104`** emails the customer when staff replies and publishes `customer_support_messages` for live alerts. Migration **`0105`** saves the sender’s name on each message.

## Scope (v1 — PR #115)

| Surface         | Route                         | Capabilities                                                     |
| --------------- | ----------------------------- | ---------------------------------------------------------------- |
| Customer portal | `/messages`, `/messages/[id]` | Start thread, list threads, reply on **open** threads            |
| Tenant portal   | `/messages`                   | Split-pane inbox, reply, close/reopen, filters (open/closed/all) |
| Customer detail | `/customers/[id]`             | **Messages (N)** link → `/messages?customer=<id>&filter=open`    |

**Not in v1:** SMS two-way inbox (`phase2Twilio` cancelled — sent.dm is transactional only).

**Shipped (Phase 2, 0073):** platform support tickets — founder `/support`, tenant `/settings/support`. Separate from customer `/messages` threads. See `docs/product/platform-support-tickets.md`.

**v1.1 (PR #115 follow-up):** email staff when a customer sends or replies (`email_notify_customer_message` in Operations settings, default on); nav badge counts threads awaiting reply.

**Live alerts:** while either portal is open, a new message from the other side refreshes the page and shows a notice within a few seconds (immediately when Supabase Realtime is available). The check is `/api/messaging/inbound`. That path skips the portal rewrite, so the handler reads the host (`acme.…` vs `my.…`, or a white-label customer domain) instead of `x-portal`. Messages includes a control to allow browser notifications for that signed-in session. Staff replies also email the customer (`email_notify_staff_reply`, default on) so they hear about it when the portal is closed. Apply **`0104`** before relying on the customer email toggle or live database events.

**Public help:** [`/help/customers/message-your-provider`](/help/customers/message-your-provider) (hub: [`/help/customers`](/help/customers)).

## Roles (tenant)

| Role     | View inbox | Reply | Close / reopen |
| -------- | ---------- | ----- | -------------- |
| Owner    | Yes        | Yes   | Yes            |
| Admin    | Yes        | Yes   | Yes            |
| Employee | Yes        | Yes   | Yes            |
| Viewer   | Yes        | No    | No             |

Access helper: `lib/tenant/supportMessagingAccess.ts` → `canReplyToSupportThreads`.

## UX notes

- **Tenant desktop:** ~240–320px thread list + conversation pane; maximizes transcript space. The inbox stays inside the viewport. The thread list and transcript scroll inside the pane.
- **Tenant mobile:** list by default; `?thread=<uuid>` shows conversation full-screen.
- **Nav badge:** count of **open threads awaiting staff reply** (`countSupportThreadsAwaitingReply`, cached via `getCachedOpenSupportThreadCount`).
- **Closed threads:** customer sees note to start a new message; tenant can reopen.
- **Sending:** the message appears in the thread immediately. The save and email finish afterward. **⌘/Ctrl + Enter** sends from the reply box (Enter still adds a line). The same shortcut starts a new customer conversation.
- **Sender name:** each message stores the signed-in person’s name (`author_display_name`, migration **`0105`**). Staff replies show that person, so several teammates can answer the same thread. The customer still sees their own messages as “You.” Apply **`0105`** before opening a thread, or the message query fails.

## Key files

| Path                                                   | Purpose                                                        |
| ------------------------------------------------------ | -------------------------------------------------------------- |
| `app/tenant/messages/`                                 | Tenant inbox page, list, conversation, server actions          |
| `app/customer/messages/`                               | Customer list, thread detail, create + reply actions           |
| `components/messaging/SupportMessageTranscript.tsx`    | Shared transcript UI                                           |
| `components/messaging/SupportMessageReplyComposer.tsx` | Reply box with instant send and ⌘/Ctrl + Enter                 |
| `lib/tenant/loadTenantSupportInbox.ts`                 | Inbox query + filters                                          |
| `lib/tenant/loadSupportThreadDetail.ts`                | Thread + messages for tenant or customer                       |
| `lib/tenant/openSupportThreadCount.ts`                 | Open thread + awaiting-reply counts                            |
| `lib/tenant/supportMessageNotifications.ts`            | Staff email on customer message; customer email on staff reply |
| `components/messaging/SupportMessageLiveAlerts.tsx`    | In-portal notice, browser notification, live refresh           |
| `app/api/messaging/inbound/route.ts`                   | Poll for the newest inbound message                            |
| `lib/tenant/buildTenantNavItems.ts`                    | Messages nav item + badge                                      |

## Follow-ups (backlog)

- SMS two-way inbox (sent.dm stays transactional only)
- Browser push when the portal tab is fully closed (email covers that case today)
