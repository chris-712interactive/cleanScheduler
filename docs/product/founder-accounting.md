# Founder and tenant accounting (Phase 2 MVP)

**Status:** Implemented (Bucket B4) — estimated platform revenue for founders; invoice/payment rollups for tenant owners and admins.

This document describes the lean accounting surfaces shipped in Phase 2. Full ledger sync, Stripe payout reconciliation at the platform level, and live accounting integrations remain future work.

---

## Goals

1. **Founder visibility** — MRR and estimated revenue YTD from platform subscriptions, plus a per-tenant subscription table and CSV export.
2. **Tenant accounting hub** — Owner/admin rollups for invoices and payments (30/90 days), outstanding AR, and CSV export for accountants.
3. **Reuse reports data** — Tenant rollups call the same helpers as `/reports` (invoice audit, collections summary, outstanding balances).

---

## Founder admin (`admin.<apex>/accounting`)

| Surface    | Route         | Access                                   |
| ---------- | ------------- | ---------------------------------------- |
| Accounting | `/accounting` | Platform admin (service role aggregates) |

### Metrics

- **MRR** — Sum of estimated monthly recurring revenue from `tenant_billing_accounts` with status `active` or `trialing`, priced from `PLATFORM_TIER_ENTITLEMENTS` and billing interval.
- **Revenue YTD (estimated)** — For each **active** paying subscription, `monthlyRecurringCents × months live` since the later of Jan 1 UTC or `activated_at`. Labeled **estimated** — not a Stripe ledger export.
- **Tenant subscriptions** — Slug, plan, status, estimated MRR, Stripe subscription id when present.

### CSV export

`GET /accounting?export=csv` downloads `platform-accounting.csv` with a platform totals row and one row per tenant.

### Code

- Page: `app/admin/accounting/page.tsx`
- Aggregates: `lib/admin/platformStats.ts` → `getPlatformAccountingSummary()`
- CSV: `lib/admin/platformAccountingCsv.ts`
- Nav: `app/admin/layout.tsx`

---

## Tenant portal (`<tenant>.<apex>/accounting`)

| Surface    | Route         | Access               |
| ---------- | ------------- | -------------------- |
| Accounting | `/accounting` | Owner and admin only |

### Metrics

- **Outstanding AR** — `getTenantOutstandingInvoicesSummary()` (open non-void invoices).
- **Last 30 / 90 days — invoices** — `runInvoiceAuditReport()` for invoices **created** in the window (billed, paid, outstanding on those invoices).
- **Last 30 / 90 days — payments** — `runCollectionsSummaryReport()` for net collected and refunds in the window.

### CSV export

`GET /accounting?export=csv` downloads `accounting-summary.csv` with section/metric rows for AR and both periods.

### Code

- Page: `app/tenant/accounting/page.tsx`
- Loader: `lib/tenant/loadTenantAccountingSummary.ts`
- CSV: `lib/tenant/tenantAccountingCsv.ts`
- Nav: `lib/tenant/buildTenantNavItems.ts` (owner/admin only)

---

## Non-goals (this MVP)

- Stripe Billing invoice history as source of truth for founder revenue
- QuickBooks / Xero live sync
- Tenant P&L, COA, or journal entries
- Replacing detailed reports under `/reports`

---

## Related

- Tenant reports hub: `docs/product/tenant-reports.md`
- Platform stats (dashboard MRR): `lib/admin/platformStats.ts` → `getPlatformDashboardStats()`
- Implementation plan todo: `phase2Accounting` in `.cursor/docs/plan/implementation-plan.md`
