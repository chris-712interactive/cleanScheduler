# Platform outreach (founder cold email)

**Status:** Implemented (v1 + signature polish)  
**Audience:** Platform admins only (`admin.<apex>`)  
**Related:** Tenant marketing campaigns remain separate — see `docs/product/email-campaigns.md`.

## Purpose

Import mail-merge contact lists (per-recipient subject + body) from a **CSV upload** or a **published Google Sheet CSV URL**, queue sends through Resend, track delivery/open/click/bounce via webhooks, and log replies manually in the admin UI.

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

1. Admin imports contacts (CSV file or published Sheet URL) → draft campaign + recipient rows (signature defaults applied).
2. On draft detail: edit **campaign signature** (logo URL, name, title, company, contact links), **preview** a recipient, **delete** unwanted rows.
3. **Queue send** marks pending recipients `queued` (no inline Resend calls).
4. Cron drains ~40 queued recipients per minute via `processOutreachSendBatch`.
5. Resend webhooks update engagement; bounces write platform suppressions.
6. Admin sets per-recipient `response_status` (`replied`, `interested`, `not_interested`, `do_not_contact`).

## Draft list UX

- Compact table: contact, email, city, status, response — no inline body preview.
- **Preview** opens a panel with subject + rendered HTML (body + signature + CAN-SPAM footer).
- **Delete** removes a recipient only while the campaign is `draft`.
- **Delete campaign** (list or detail) removes `draft`, `cancelled`, `failed`, or `sent` campaigns (and cascaded recipients). Not allowed while `queued` / `sending` — cancel first.

## Campaign signature

Stored on `platform_outreach_campaigns` (migration `0079`):

- `signature_enabled`, `signature_name`, `signature_title`, `signature_company`
- `signature_email`, `signature_phone`, `signature_website`, `signature_logo_url` (HTTPS)

When enabled, the signature is appended after the CSV `Body` on every send. Keep personal copy in `Body`; do not paste a signature into each row.

## Import sources

| Source       | How                                                                                               |
| ------------ | ------------------------------------------------------------------------------------------------- |
| CSV file     | Upload on `/outreach/new` (max 2 MB)                                                              |
| Google Sheet | File → Share → Publish to web → CSV, paste `/pub?output=csv` (or public `/export?format=csv`) URL |

Only `https://docs.google.com/...` published/export CSV URLs are accepted as the source link (`lib/admin/fetchPublishedOutreachCsv.ts`). Edit/share links are rejected. After download, Google may redirect to `*.googleusercontent.com` or `spreadsheets.google.com`; those hosts are allowed for the response. The sheet must be publicly readable via that URL.

## CSV columns

**Required:** `Email`, `Subject`, `Body`  
**Optional:** Business Name, Owner Name, Phone, City, County, Type, Website, Notes

Rows missing email/content are skipped at import. Emails already in `platform_outreach_suppressions` import as `skipped`.

## Compliance

- Platform physical address + unsubscribe link appended to every send (`lib/admin/outreachEmailBody.ts`).
- Suppressions: unsubscribe link, bounce webhook, or manual `do_not_contact`.
- From address: `RESEND_FROM_EMAIL` (platform).

## Schema

- `0078_platform_outreach.sql` — campaigns, recipients, suppressions
- `0079_platform_outreach_signature.sql` — campaign signature columns

RLS: `is_platform_admin()`; service role used by admin portal + cron/webhooks.

## Webhook routing

[`lib/campaigns/handleResendWebhook.ts`](../../lib/campaigns/handleResendWebhook.ts) looks up tenant campaign recipients first; if none, matches `platform_outreach_recipients.resend_email_id`.

Resend tags on send: `outreach_campaign_id`, `outreach_recipient_id`.

## Out of scope

- Logo file upload / storage
- Platform-wide signature settings page
- Tenant-facing cold outreach
- Inbound reply detection
- Rich HTML body editor for CSV rows
- SMS outreach
