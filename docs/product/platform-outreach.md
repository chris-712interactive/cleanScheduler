# Platform outreach (founder cold email)

**Status:** Implemented (v1)  
**Audience:** Platform admins only (`admin.<apex>`)  
**Related:** Tenant marketing campaigns remain separate — see `docs/product/email-campaigns.md`.

## Purpose

Import mail-merge contact CSVs (per-recipient subject + body), queue sends through Resend, track delivery/open/click/bounce via webhooks, and log replies manually in the admin UI.

## Routes

| Surface         | Path                                     |
| --------------- | ---------------------------------------- |
| Campaign list   | `/outreach`                              |
| CSV import      | `/outreach/new`                          |
| Campaign detail | `/outreach/[id]`                         |
| Unsubscribe     | `/api/outreach/unsubscribe?token=…`      |
| Send cron       | `/api/cron/outreach-send` (every minute) |

## Lifecycle

`draft` → `queued` → `sending` → `sent` | `cancelled` | `failed`

1. Admin uploads CSV → draft campaign + recipient rows.
2. **Queue send** marks pending recipients `queued` (no inline Resend calls).
3. Cron drains ~40 queued recipients per minute via `processOutreachSendBatch`.
4. Resend webhooks update engagement; bounces write platform suppressions.
5. Admin sets per-recipient `response_status` (`replied`, `interested`, `not_interested`, `do_not_contact`).

## CSV columns

**Required:** `Email`, `Subject`, `Body`  
**Optional:** Business Name, Owner Name, Phone, City, County, Type, Website, Notes

Rows missing email/content are skipped at import. Emails already in `platform_outreach_suppressions` import as `skipped`.

## Compliance

- Platform physical address + unsubscribe link appended to every send (`lib/admin/outreachEmailBody.ts`).
- Suppressions: unsubscribe link, bounce webhook, or manual `do_not_contact`.
- From address: `RESEND_FROM_EMAIL` (platform).

## Schema

Migration `0078_platform_outreach.sql`:

- `platform_outreach_campaigns`
- `platform_outreach_recipients`
- `platform_outreach_suppressions`

RLS: `is_platform_admin()`; service role used by admin portal + cron/webhooks.

## Webhook routing

[`lib/campaigns/handleResendWebhook.ts`](../../lib/campaigns/handleResendWebhook.ts) looks up tenant campaign recipients first; if none, matches `platform_outreach_recipients.resend_email_id`.

Resend tags on send: `outreach_campaign_id`, `outreach_recipient_id`.

## Out of scope (v1)

- Tenant-facing cold outreach
- Inbound reply detection
- Shared compose editor / merge-tag templates
- SMS outreach
