# Email campaigns — product & implementation plan

Plan-gated marketing broadcasts for **Business** and **Pro** tenants. Starter workspaces see an upgrade prompt; transactional mail (quotes, invoices, invites) is never metered against campaign credits.

## Entitlements

| Control | Starter | Business | Pro |
|---------|---------|----------|-----|
| `campaigns` feature | No | Yes | Yes |
| `includedEmailCreditsMonthly` (marketing) | — | 25,000 | 100,000 |
| `maxCampaignSendsMonthly` | — | 10,000 | 40,000 |
| `maxConcurrentActiveCampaigns` | — | 3 | 10 |
| `maxCampaignAudienceSize` | — | 5,000 | 15,000 |
| `maxCampaignDrafts` | — | 20 | 50 |

Canonical values live in `lib/billing/entitlements.ts`. Transactional Resend sends do **not** consume `includedEmailCreditsMonthly`.

## Roles

| Role | View list & metrics | Create / edit / send |
|------|---------------------|----------------------|
| Owner | Yes | Yes |
| Admin | Yes | Yes |
| Employee | Yes | No |
| Viewer | Yes | No |

## Audience & compliance

- **Marketing opt-in** (`tenant_customer_profiles.marketing_email_opt_in`, default `false`).
- **Suppressions** (`tenant_email_suppressions`) — unsubscribe, bounce, complaint, manual.
- Baseline send predicate: active customer + email on file + marketing opt-in + not suppressed.
- CAN-SPAM footer: tenant name, business address, unsubscribe link.

## Campaign lifecycle

`draft` → `sending` → `sent` | `failed` | `cancelled`

**MVP:** send now only. **V1.1:** scheduled sends via cron.

## Audience presets (MVP)

| Preset | Description |
|--------|-------------|
| `all_marketable` | Active + email + opt-in + not suppressed |
| `email_preferred` | Above + preferred contact email or unset |
| `residential` | Above + primary property residential |
| `portal_nudge` | Above + no customer portal login |
| `open_balance` | Above + open invoice |

## Pages

| Route | Purpose |
|-------|---------|
| `/campaigns` | KPI strip + status tabs + table + pagination |
| `/campaigns/new` | Create draft / send |
| `/campaigns/[id]` | Detail metrics + recipient activity |

Starter: upgrade card on `/campaigns` (billing hub pattern).

## Send architecture (MVP)

1. Resolve audience in Postgres.
2. Insert `tenant_email_campaign_recipients` rows.
3. Send via `sendTransactionalEmail` with Resend **tags** (`campaign_id`, `tenant_id`, `recipient_id`).
4. Resend webhooks (`email.opened`, `email.clicked`, `email.delivered`, `email.bounced`) update recipient + campaign aggregates.

**V2:** Resend Broadcasts + Segments for scale.

## Schema

- `tenant_email_campaigns` — campaign metadata, status, metrics denormalized
- `tenant_email_campaign_recipients` — per-recipient send + engagement
- `tenant_email_suppressions` — per-tenant email blocks
- `tenant_customer_profiles.marketing_email_opt_in` — consent flag
- `resend_webhook_events` — webhook idempotency

## Phasing

| Phase | Scope |
|-------|--------|
| **MVP (shipped in repo)** | Feature gate, schema, list/create/detail, presets, send now, webhooks, opt-in |
| **V1.1** | Scheduled sends, saved segments, credit warning banners, duplicate campaign |
| **V2** | WYSIWYG builder, Resend Broadcasts, advanced segmentation, Pro branded domain |

## Related docs

- `docs/billing/tier-entitlements.md` — metering hooks
- `.cursor/docs/starterPlan/tenantPortalRequirements.md` — original requirements
- `.cursor/docs/plan/implementation-plan.md` — Phase 3 roadmap
