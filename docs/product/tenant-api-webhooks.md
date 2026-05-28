# Tenant API & Outbound Webhooks (Pro)

Pro workspaces get a read-only REST API and outbound webhooks for automation (Zapier, custom backends).

## Entitlements

| Capability        | Gate                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| REST API          | `fullApiWebhooks` + paid subscription (`active` or `past_due`)                                              |
| Outbound webhooks | Same                                                                                                        |
| Connection limit  | `includedIntegrations` (Starter 1, Business 5, Pro 20) — counts active API keys + enabled webhook endpoints |

**Not available during free trial**, same as SMS.

Implementation: `lib/integrations/integrationLimits.ts`, `lib/integrations/authenticateTenantApiRequest.ts`.

## Settings UI

**Settings → Integrations** (`app/tenant/settings/integrations/`)

- Create / revoke API keys (plain key shown once)
- Add / enable / disable / delete webhook endpoints (signing secret shown once)
- Send test webhook (`quote.sent` payload with `test: true`)

## REST API (v1)

Base URL: `https://<apex>/api/v1` (local: `http://lvh.me:3000/api/v1`)

Auth header:

```http
Authorization: Bearer cs_live_…
```

| Method | Path         | Query params                              |
| ------ | ------------ | ----------------------------------------- |
| GET    | `/customers` | `limit`, `offset`, `status`               |
| GET    | `/quotes`    | `limit`, `offset`, `status`               |
| GET    | `/visits`    | `limit`, `offset`, `status`, `from`, `to` |
| GET    | `/invoices`  | `limit`, `offset`, `status`               |

Responses: `{ data: [...], pagination: { limit, offset, total } }`

## Outbound webhooks

Event envelope:

```json
{
  "id": "uuid",
  "type": "quote.sent",
  "created_at": "ISO-8601",
  "data": { "quote_id": "…", "customer_id": "…", "title": "…", "status": "sent" }
}
```

Signature header: `X-CleanScheduler-Signature: t=<unix>,v1=<hmac-sha256-hex>`

HMAC is computed over `{timestamp}.{raw_json_body}` using the endpoint signing secret.

### Event types

| Type              | Emitted today                           |
| ----------------- | --------------------------------------- |
| `quote.sent`      | Yes — tenant marks quote sent           |
| `quote.accepted`  | Yes — customer accepts                  |
| `quote.declined`  | Yes — customer declines                 |
| `invoice.paid`    | Yes — payment records + Stripe Checkout |
| `visit.scheduled` | Yes — manual visit create               |
| `visit.completed` | Yes — field visit completion            |

Delivery: immediate attempt + cron retry (`/api/cron/deliver-tenant-webhooks`, every 5 min, max 5 attempts with exponential backoff).

## Schema

Migration `0040_tenant_api_webhooks.sql`:

- `tenant_api_keys` — hashed keys, prefix for display
- `tenant_webhook_endpoints` — URL, event filter, signing secret (service role only)
- `tenant_webhook_deliveries` — audit + retry queue

## Library map

| Module                                             | Role                                |
| -------------------------------------------------- | ----------------------------------- |
| `lib/integrations/integrationSecrets.ts`           | Key/secret generation, HMAC signing |
| `lib/integrations/authenticateTenantApiRequest.ts` | Bearer API key auth                 |
| `lib/integrations/integrationLimits.ts`            | Pro + paid + connection cap         |
| `lib/integrations/emitTenantWebhook.ts`            | Enqueue + deliver + cron processor  |
| `lib/integrations/emitQuoteWebhook.ts`             | Quote lifecycle hooks               |
| `lib/integrations/tenantPublicApi.ts`              | Shared list-route helpers           |
