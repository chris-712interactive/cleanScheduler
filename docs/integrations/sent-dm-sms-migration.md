# sent.dm SMS migration (Twilio replacement)

**Status:** Implemented in application code (migration `0054` + sent.dm transport). Configure Sent accounts and env vars before enabling sends in each environment.  
**Last updated:** 2026-05-26  
**Owner:** Engineering

This document is the source of truth for replacing Twilio with [sent.dm](https://www.sent.dm/) for Pro transactional messaging. Use it to resume work across sessions or PRs.

---

## Goals

- Swap the **transport layer** only; keep product behavior, entitlements, metering, and call-site structure.
- Use **purpose-specific** sent.dm templates (not a single freeform body template).
- Default to **SMS-only** sends; allow **multi-channel** (WhatsApp, RCS) per tenant via operational settings.
- **DEV/local:** all API sends use sent.dm **sandbox** (no real delivery, no charges).
- **PROD:** real sends after KYC, approved templates, and webhook registration.

## Non-goals (this migration)

- Inbound / two-way SMS and per-tenant phone numbers (see `.cursor/docs/plan/implementation-plan.md` Phase 2).
- SMS marketing campaigns.
- Dual-provider runtime (Twilio + sent.dm); rollback = redeploy + restore env.

---

## Decisions (locked)

| #   | Topic           | Decision                                                                                                                                                                                                              |
| --- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Templates       | **Five purpose-specific** templates — one per `SmsPurpose` in `lib/sms/sendTransactionalSms.ts`.                                                                                                                      |
| 2   | Channels        | **Default `['sms']`**. Tenants may opt into additional channels via **tenant operational settings** (see schema below).                                                                                               |
| 3   | Delivery status | **Webhook + DB column in Phase 1** (`delivery_status` on `tenant_sms_messages`). **No tenant UI** for delivery status in Phase 1; optional admin/ops view in Phase 2.                                                 |
| 4   | DEV sends       | **`sandbox: true` whenever `NEXT_PUBLIC_APP_ENV` is `local` or `dev`** (`isLocal()` / `isDev()` from `lib/env.ts`). PROD never uses sandbox unless an explicit break-glass env override is added later (not planned). |

---

## Current architecture (Twilio)

```
quoteNotificationSms ──┐
visitReminderSms ──────┼──► sendTransactionalSms ──► smsCredits gate ──► twilioServer
invoiceReminders ──────┘         │                           │
                                 └── tenant_sms_messages (twilio_sid)
```

**Key files today:**

| Path                                               | Role                                 |
| -------------------------------------------------- | ------------------------------------ |
| `lib/sms/sendTransactionalSms.ts`                  | Gate, send, log                      |
| `lib/sms/twilioServer.ts`                          | Client + `isTwilioConfigured()`      |
| `lib/sms/quoteNotificationSms.ts`                  | Quote sent / accept / decline        |
| `lib/sms/visitReminderSms.ts`                      | ~24h visit reminders (cron)          |
| `lib/billing/invoiceReminders.ts`                  | Overdue invoice SMS                  |
| `lib/billing/smsCredits.ts`                        | Pro feature + monthly segment limits |
| `supabase/migrations/0039_tenant_sms_messages.sql` | Audit + metering table               |
| `app/api/cron/visit-sms-reminders/route.ts`        | Vercel cron entry                    |

**Env (remove after migration):** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

---

## Target architecture (sent.dm)

```
callers (unchanged entry points)
    └── sendTransactionalSms
            ├── smsCredits (unchanged)
            ├── resolveChannels(tenantId)  ← tenant_operational_settings
            ├── sentTemplateConfig(purpose) → template id + parameters
            ├── sentDmServer → @sentdm/sentdm client.messages.send()
            └── tenant_sms_messages (provider_message_id, delivery_status)
                    ▲
                    └── POST /api/webhooks/sent (async status updates)
```

### sent.dm constraints

- All sends use **`POST /v3/messages`** with an **approved template** and `parameters` — no arbitrary freeform body at the API layer.
- Pre-send segment metering stays on **client-side GSM-7 estimate** (`lib/sms/estimateSmsSegments.ts`); actual carrier segments may differ slightly.
- Webhooks are the recommended way to track **delivered / failed** (do not poll in production).

References:

- [Sending messages](https://docs.sent.dm/start/guides/sending-messages)
- [TypeScript SDK](https://docs.sent.dm/sdks/typescript)
- [Webhook signature verification](https://docs.sent.dm/start/webhooks/signature-verification)

---

## Purpose-specific templates

Create and approve these in the sent.dm dashboard (DEV + PROD workspaces). Store template UUIDs in environment variables.

| `SmsPurpose`      | Env var                            | Suggested template body                                                              | Parameters                                              |
| ----------------- | ---------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------- |
| `quote_sent`      | `SENT_DM_TEMPLATE_QUOTE_SENT`      | `{tenant_name}: New quote "{quote_title}". View & respond: {link}`                   | `tenant_name`, `quote_title`, `link`                    |
| `quote_accepted`  | `SENT_DM_TEMPLATE_QUOTE_ACCEPTED`  | `{tenant_name}: A customer accepted quote "{quote_title}".`                          | `tenant_name`, `quote_title`                            |
| `quote_declined`  | `SENT_DM_TEMPLATE_QUOTE_DECLINED`  | `{tenant_name}: A customer declined quote "{quote_title}".`                          | `tenant_name`, `quote_title`                            |
| `visit_reminder`  | `SENT_DM_TEMPLATE_VISIT_REMINDER`  | `{tenant_name}: Reminder — "{visit_title}" is scheduled for {when}.`                 | `tenant_name`, `visit_title`, `when`                    |
| `invoice_overdue` | `SENT_DM_TEMPLATE_INVOICE_OVERDUE` | `{tenant_name}: Invoice "{invoice_title}" ({balance}) is overdue. Pay: {portal_url}` | `tenant_name`, `invoice_title`, `balance`, `portal_url` |

**Implementation note:** Refactor callers to pass **structured fields** into `sendTransactionalSms` (or an internal `SendTransactionalSmsInput` type). Keep storing a rendered preview string in `body_preview` for audit.

---

## Channel selection (tenant settings)

### Default

- Platform default: `channel: ['sms']` on every send.

### Tenant override

Add to `tenant_operational_settings` (migration `0054` or `0055`):

```sql
-- Ordered preference; must include 'sms' when any messaging channel is enabled.
alter table public.tenant_operational_settings
  add column if not exists messaging_channels text[] not null default array['sms']::text[];

alter table public.tenant_operational_settings
  add constraint tenant_operational_settings_messaging_channels_check
  check (
    messaging_channels <@ array['sms', 'whatsapp', 'rcs']::text[]
    and cardinality(messaging_channels) >= 1
    and 'sms' = any (messaging_channels)
  );

comment on column public.tenant_operational_settings.messaging_channels is
  'sent.dm delivery channels for transactional messages. Default SMS only; Pro tenants may add whatsapp/rcs when enabled on the Sent account.';
```

**Product rules:**

- UI on **Settings → Operations** (Pro + sent.dm configured): checkboxes for WhatsApp and RCS; SMS always on and not deselectable.
- If tenant selects WhatsApp/RCS but the Sent account has not completed channel setup, send fails gracefully with a logged error and `tenant_sms_messages.status = 'failed'`.
- **Metering:** Each channel creates a separate sent.dm message per recipient. Count **one segment credit per successful outbound log row** (existing `segment_count` on insert). If multi-channel sends one logical notification on two channels, that consumes two rows / two segment counts — document this in the Operations UI help text.

**Server helper:** `resolveMessagingChannels(admin, tenantId): ('sms' | 'whatsapp' | 'rcs')[]` used inside `sendTransactionalSms`.

---

## Environment variables

### Remove

```bash
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

### Add

```bash
# sent.dm — https://app.sent.dm
SENT_DM_API_KEY=

# Webhook signing secret (whsec_…) — dashboard → Webhooks
SENT_WEBHOOK_SECRET=

# Purpose-specific template IDs (UUIDs from Sent dashboard)
SENT_DM_TEMPLATE_QUOTE_SENT=
SENT_DM_TEMPLATE_QUOTE_ACCEPTED=
SENT_DM_TEMPLATE_QUOTE_DECLINED=
SENT_DM_TEMPLATE_VISIT_REMINDER=
SENT_DM_TEMPLATE_INVOICE_OVERDUE=
```

### Sandbox behavior (decision #4)

In `sendTransactionalSms` (or `sentDmServer`):

```ts
import { isDev, isLocal } from '@/lib/env';

const sandbox = isLocal() || isDev();
// client.messages.send({ ..., sandbox })
```

- **local / dev:** `sandbox: true` always — validates request, no real send, `X-Sandbox: true` in response per Sent docs.
- **prod:** `sandbox: false` — real delivery.

Do **not** add a tenant-facing sandbox toggle.

### Webhook URL

Register in Sent dashboard (per environment):

```text
https://<apex>/api/webhooks/sent
```

Suggested `event_filters`: `message.delivered`, `message.failed`, `message.sent` (optional), `message.received` (future inbound).

---

## Database migration

**File:** `supabase/migrations/0054_sent_dm_sms_provider.sql` (number may shift if other migrations land first)

```sql
-- Provider-agnostic outbound id (historical Twilio SIDs remain valid)
alter table public.tenant_sms_messages
  rename column twilio_sid to provider_message_id;

comment on column public.tenant_sms_messages.provider_message_id is
  'Outbound message id from SMS provider (Twilio SID or sent.dm message UUID).';

-- Async delivery lifecycle (updated via /api/webhooks/sent)
alter table public.tenant_sms_messages
  add column if not exists delivery_status text null
    check (delivery_status in ('queued', 'sent', 'delivered', 'failed', 'read'));

-- Tenant channel preferences (see "Channel selection" above)
alter table public.tenant_operational_settings
  add column if not exists messaging_channels text[] not null default array['sms']::text[];

-- Update visit reminder comment
comment on column public.tenant_operational_settings.sms_notify_visit_reminder is
  'Send SMS ~24h before scheduled visits (Pro + sent.dm).';
```

After applying: `npm run db:types`.

**`tenant_sms_messages.status`** (existing): keep `sent` | `failed` for **API accept/reject** at send time. Use **`delivery_status`** for webhook-driven carrier lifecycle.

---

## Code changes checklist

### New files

| File                                  | Purpose                                             |
| ------------------------------------- | --------------------------------------------------- |
| `lib/sms/sentDmServer.ts`             | `isSentDmConfigured()`, lazy `SentDm` client        |
| `lib/sms/sentTemplateConfig.ts`       | `SmsPurpose` → template id + parameters builder     |
| `lib/sms/resolveMessagingChannels.ts` | Read `messaging_channels` from operational settings |
| `app/api/webhooks/sent/route.ts`      | Signature verify + update `delivery_status`         |

### Edit

| File                                              | Change                                                |
| ------------------------------------------------- | ----------------------------------------------------- |
| `lib/sms/sendTransactionalSms.ts`                 | sent.dm send; sandbox flag; log `provider_message_id` |
| `lib/sms/quoteNotificationSms.ts`                 | Structured template params                            |
| `lib/sms/visitReminderSms.ts`                     | Structured params; `isSentDmConfigured`               |
| `lib/billing/invoiceReminders.ts`                 | Structured params                                     |
| `lib/env.ts`                                      | `SENT_DM_*` schema; remove `TWILIO_*`                 |
| `.env.example`                                    | Document new vars                                     |
| `package.json`                                    | Add `@sentdm/sentdm`, remove `twilio`                 |
| `app/tenant/settings/OperationalSettingsForm.tsx` | sent.dm copy; channel checkboxes                      |
| `app/tenant/settings/operations/page.tsx`         | `sentDmConfigured`                                    |
| `app/tenant/settings/operations/actions.ts`       | Persist `messaging_channels`                          |
| `lib/legal/thirdPartyServices.ts`                 | Twilio → Sent                                         |
| `lib/legal/dataRetentionSchedule.ts`              | SMS provider name                                     |
| `lib/legal/informationSecurityPolicy.ts`          | Subprocessor list                                     |
| `docs/billing/tier-entitlements.md`               | Provider references                                   |
| `docs/ops/runtime-eol-policy.md`                  | Dependency list                                       |

### Delete

| File                      |
| ------------------------- |
| `lib/sms/twilioServer.ts` |

### Unchanged (by design)

- `lib/billing/smsCredits.ts`
- Entitlement flag `smsCommunication` (Pro only)
- Cron route `app/api/cron/visit-sms-reminders/route.ts` (behavior only)
- Unique index preventing duplicate visit reminder sends

---

## Webhook handler (`/api/webhooks/sent`)

Follow patterns from `app/api/webhooks/stripe/route.ts`:

1. Read **raw body** (`request.text()` or `express.raw` equivalent in Next.js route).
2. Verify `x-webhook-signature` using `SENT_WEBHOOK_SECRET` (`whsec_` → strip prefix → base64-decode key).
3. Reject timestamps older than 5 minutes (replay protection).
4. Parse JSON; on `event.field === 'message'` and outbound status sub-types, `UPDATE tenant_sms_messages SET delivery_status = $status WHERE provider_message_id = $message_id`.
5. Return `200` immediately; no heavy work.
6. **Idempotency:** safe to process duplicate events (same `message_id` + status).

Inbound (`message.received`): log only in Phase 1; wire to Messages product in a later phase.

---

## Phased delivery (PRs)

| PR              | Scope                                                                                         | Exit criteria                                       |
| --------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **A — Ops**     | Sent accounts, KYC (prod), create/approve 5 templates, register webhooks, fill env in Vercel  | Sandbox send per template from dashboard or curl    |
| **B — Core**    | `sentDmServer`, `sentTemplateConfig`, `sendTransactionalSms`, migration `0054`, remove Twilio | Staging sends (sandbox in dev); types + tests green |
| **C — Webhook** | `app/api/webhooks/sent/route.ts`, `delivery_status` updates                                   | Test event updates row in DB                        |
| **D — Product** | Operations UI (sent.dm copy + channel checkboxes), legal/docs, structured params in callers   | Tenant can enable WhatsApp/RCS; docs accurate       |

---

## Testing

| Layer               | What to verify                                                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Unit                | Template param mapping per purpose; channel resolver defaults to `['sms']`; sandbox forced when `isDev()` / `isLocal()` |
| Integration         | Mock Sent client; failed send writes `status = 'failed'`                                                                |
| Manual (dev)        | Quote sent SMS → row in `tenant_sms_messages`, sandbox header, no real phone delivery                                   |
| Manual (prod smoke) | One quote_sent + one visit_reminder after go-live                                                                       |
| Webhook             | Sent dashboard test delivery → `delivery_status` updated                                                                |

Commands: `npm run typecheck`, `npm run test`, `npm run build`.

---

## Rollout

1. Merge PR B–D with sent.dm **configured in DEV only** first.
2. Complete PR A for **PROD** (templates approved, prod API key, webhook).
3. Deploy; smoke test two message types.
4. Remove `TWILIO_*` from all Vercel environments.
5. Monitor for 48h: `tenant_sms_messages` where `status = 'failed'` or `delivery_status = 'failed'`.

**Rollback:** Revert deploy; restore Twilio env vars. Historical `provider_message_id` values remain valid Twilio SIDs.

---

## Account setup (PR A checklist)

- [ ] DEV workspace: API key, 5 templates (sandbox OK before approval)
- [ ] PROD workspace: KYC, sender number, 5 templates submitted/approved
- [ ] Webhook endpoints for dev + prod apex domains
- [ ] Vercel env: all `SENT_DM_*` vars per environment
- [ ] Confirm `NEXT_PUBLIC_APP_ENV=dev` on preview/dev deployment (sandbox enforced)

---

## Risks

| Risk                                         | Mitigation                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Template approval 24–48h                     | Start PR A early; dev uses sandbox without approval for OTP-style templates if needed |
| Multi-channel doubles send volume / segments | UI copy + meter per log row; default SMS-only                                         |
| WhatsApp/RCS not provisioned on Sent account | Graceful failure + ops alert                                                          |
| Segment estimate vs carrier billing          | Document variance; optional reconciliation via `messages.retrieveActivities` later    |
| STOP/HELP compliance                         | Subscribe to `message.received`; block sends to opted-out contacts (future hardening) |

---

## Related docs

- `docs/billing/tier-entitlements.md` — Pro SMS limits and features
- `.cursor/docs/plan/implementation-plan.md` — Phase 2 inbound SMS / per-tenant numbers (future)
- [Sent message status tracking](https://docs.sent.dm/start/guides/message-status-tracking)
