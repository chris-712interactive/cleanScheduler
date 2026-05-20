# Tenant Reports — design & implementation plan

One-stop reporting for cleaning businesses: day-to-day operations, monthly bookkeeping close, payroll inputs, and year-end tax prep. Reports live at **`/reports`** (top-level tenant nav). Operational **payment workflows** (mark received / deposited) stay under **`/billing/payment-audits`**.

**Status:** Phase 1 core reports implemented in repo; Phase 1.5+ analytics pending.

---

## Goals

1. **Owner / office manager** — see cash, jobs, and collections without exporting to spreadsheets daily.
2. **Bookkeeper / accountant** — reconcile card payouts, offline checks, and open AR with CSV/PDF exports and date filters.
3. **Payroll** — hours and labor cost rollups exportable to ADP / Gusto / QuickBooks (Phase 2).
4. **Year-end** — 1099-relevant customer totals, processing-fee deductions, audit trail links (Phase 3).

Reports are **read-only analytics**. Mutations (mark check deposited, record payment) remain on Billing and Schedule.

---

## Audiences & cadence

| Audience | Typical cadence | Needs |
|----------|-----------------|--------|
| **Office manager** | Daily / weekly | Schedule completions, field cash/checks in limbo, overdue AR calls |
| **Owner** | Weekly / monthly | Revenue mix, crew utilization, quote pipeline, MRR |
| **Accountant** | Monthly / quarterly / year-end | Invoice audit, reconciliation by method, aging, sales tax, fee totals |

Each report page ships with **suggested default ranges** (Today, Last 7 days, MTD, Last month, YTD, Custom) via URL `from` / `to` params — same pattern as `/billing/payment-audits`.

---

## Report catalog

### Phase 1 — Core (MVP)

| Slug | Title | Default range | Primary data | Tier gate |
|------|-------|---------------|--------------|-----------|
| `outstanding-balances` | Outstanding balances (AR aging) | As of today | `tenant_invoices` | **All tiers** |
| `invoice-audit` | Invoice audit | Last month | `tenant_invoices`, `tenant_invoice_payments` | **All tiers** |
| `field-check-tracking` | Field check tracking | Last 30 days | `tenant_invoice_payments` (check + manual audit cols) | **All tiers** |
| `collections-summary` | Collections summary | Last 7 days | Payments + invoices | **All tiers** |
| `quote-pipeline` | Quote pipeline | Last 30 days | `tenant_quotes`, line items | **All tiers** |

**Outstanding balances** — open invoices grouped by customer with buckets **0–30 / 31–60 / 61–90 / 90+** days (extends `lib/billing/outstandingInvoices.ts`).

**Invoice audit** — every invoice in range: status, customer, issued/due/paid dates, days outstanding, total, amount paid, payment methods used.

**Field check tracking** — read-only view of check payments with check # (from `notes` today), amount, customer, invoice, days outstanding, audit stage (`awaiting_receipt` → `awaiting_deposit` → `complete`). Links to **Payment audits** for actions.

**Collections summary** — cash collected in period by method (card / cash / check / Zelle / ACH / other), refunds, net collected.

**Quote pipeline** — counts and $ by status (`draft`, `sent`, `accepted`, …); optional line-item mix preview.

### Phase 1.5 — Growth analytics (Pro)

Requires `advancedAnalytics` (`lib/billing/entitlements.ts` — **Pro only** today).

| Slug | Title | Primary data | Notes |
|------|-------|--------------|-------|
| `payment-reconciliation` | Payment reconciliation | `tenant_invoice_payments`, `tenant_stripe_payouts` | Group by method; card section groups by payout when `stripe_payout_id` backfill exists |
| `revenue-by-customer` | Revenue by customer | Paid invoices / payments in range | Top customers, concentration |
| `revenue-by-service` | Revenue by service | `tenant_quote_line_items` + accepted quotes | Free-text `service_label` normalization; cash attribution limited until invoice line items |
| `recurring-revenue` | Recurring revenue (MRR) | `customer_subscriptions` ⋈ `service_plans` | Accrual MRR; normalize week/year → monthly |
| `employee-performance` | Employee performance | Visits ⋈ assignees | Jobs completed, scheduled hours, completion rate |

**Employee performance (basic):** hours from `ends_at - starts_at` on assigned completed visits; jobs completed count; optional **labor cost** when `labor_cost_per_hour` exists on team profile (see Schema prerequisites).

### Phase 2 — Payroll, tax, ops

| Slug | Title | Proposed gate | Notes |
|------|-------|---------------|-------|
| `payroll-export` | Payroll export | `advancedAnalytics` + future `payrollExports` | ADP / Gusto / QBO CSV formats |
| `sales-tax-summary` | Sales tax by jurisdiction | Future `salesTaxSummary` (**Business+**) | Service address → state/ZIP; tax from quote `tax_mode` / `tax_rate_bps` until invoice tax columns exist |
| `tips-commissions` | Tips & commissions | `jobCosting` | Requires `compensation_rules` |
| `crew-utilization` | Crew utilization | `advancedAnalytics` | Scheduled hours vs configurable capacity |
| `on-time-arrival` | On-time arrival | `advancedAnalytics` | Check-in vs `starts_at` (proxy until GPS) |

### Phase 3 — Year-end & strategic

| Slug | Title | Gate | Notes |
|------|-------|------|-------|
| `year-end-revenue` | Year-end revenue & fees | `advancedAnalytics` | Sum gross, Stripe fees, net; per customer 1099 inputs |
| `customer-1099-prep` | 1099 prep by customer | `advancedAnalytics` | Threshold flagging |
| `processing-fees-deductible` | Processing fees (deductible) | All tiers (basic) or Pro (detail) | `stripe_fee_cents` rollup |
| `cohort-ltv-churn` | Cohort / LTV / churn | `forecasting` | Pro only |

---

## Tier gating matrix (canonical for build)

Align with `lib/billing/entitlements.ts`. **Starter gets real reports**, not an empty hub — basic bookkeeping is table-stakes for a cleaning business.

| Capability | Starter | Business | Pro |
|------------|---------|----------|-----|
| Reports hub + Phase 1 core (5 reports) | Yes | Yes | Yes |
| CSV export (Phase 1 reports) | Yes | Yes | Yes |
| PDF export (Phase 1 reports) | Yes | Yes | Yes |
| Phase 1.5 analytics bundle | No | No | Yes (`advancedAnalytics`) |
| Sales tax summary | No | Yes (future `salesTaxSummary`) | Yes |
| Payroll provider exports | No | Yes (future `payrollExports`) | Yes |
| Plaid bank match reports | No | Yes (future `plaidReconciliation`) | Yes |
| Cohort / forecasting | No | No | Yes (`forecasting`) |

**Enforcement pattern** (mirror email campaigns):

1. `lib/reports/reportCatalog.ts` — slug → title, description, phase, `ReportGate`.
2. `isReportEnabled(tier, slug)` / `assertReportEnabled(tier, slug)` on run + export.
3. Hub shows **all** report cards; locked cards use upgrade panel → `/billing`.
4. Deep links to locked reports: upgrade panel (not `404`).
5. **Reports nav always visible** for subscribed tenants (unlike campaigns on Starter).

**Future `EntitlementFeature` keys to add** (Phase 2 — keep in sync with `entitlements.ts`):

- `salesTaxSummary`
- `payrollExports`
- `plaidReconciliation`

Until those exist, gate Phase 2 reports with `advancedAnalytics` or `jobCosting` as noted above.

**Not gated by Connect:** cash/check/Zelle reports work without Stripe Connect. Card reconciliation sections show “Connect not set up” empty state when `stripe_connect_status !== 'complete'`.

---

## Roles

| Role | View reports | Run / refresh | Export CSV/PDF |
|------|--------------|---------------|----------------|
| Owner | Yes | Yes | Yes |
| Admin | Yes | Yes | Yes |
| Employee | Yes | No | No |
| Viewer | Yes | No | No |

Optional later: hide payroll exports from `employee` role even when view is allowed.

---

## UI design

### Hub — `/reports`

```
┌─────────────────────────────────────────────────────────────┐
│ ← (none)  Reports ⓘ                    [Optional: YTD KPI] │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ $ Outstanding│  │ Collected    │  │ Open checks  │       │
│  │   (AR total) │  │  (7d)        │  │  in limbo    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
├─────────────────────────────────────────────────────────────┤
│  FINANCIAL CLOSE          OPERATIONS           PAYROLL/TAX  │
│  ┌─────────────────┐     ┌─────────────────┐   ┌──────────┐ │
│  │ Invoice audit   │     │ Quote pipeline  │   │ Employee │ │
│  │ AR aging        │     │ Field checks    │   │ perform. │ │
│  │ Collections     │     │                 │   │ 🔒 Pro   │ │
│  │ Reconciliation  │     │                 │   └──────────┘ │
│  │ 🔒 Pro          │     │                 │                │
│  └─────────────────┘     └─────────────────┘                │
└─────────────────────────────────────────────────────────────┘
```

**Pattern:** Settings hub — `hubGrid` + `hubCard` from `app/tenant/settings/settings.module.scss`. Optional KPI strip reuses `DashboardStatCard` (same as Campaigns).

**Sections:** group cards by **Financial close**, **Operations**, **Payroll & tax** (Phase 2 cards appear with lock badge when gated).

### Report run page — `/reports/[slug]`

```
┌─────────────────────────────────────────────────────────────┐
│ ← Reports   Invoice audit ⓘ              [Export CSV] [PDF] │
├─────────────────────────────────────────────────────────────┤
│  From [____] To [____]  [Apply]  Presets: 7d | MTD | YTD   │
├─────────────────────────────────────────────────────────────┤
│  Summary strip: 42 invoices | $18,420 billed | $16,200 paid │
├─────────────────────────────────────────────────────────────┤
│  ┌─ tablePanel ─────────────────────────────────────────┐  │
│  │ Customer | Invoice | Status | Due | Paid | Days | $  │  │
│  │ ... paginated ...                                     │  │
│  └───────────────────────────────────────────────────────┘  │
│  Showing 1–25 of 142          [ < 1 2 3 ... > ]             │
└─────────────────────────────────────────────────────────────┘
```

**Pattern:** Payment audits — date range form, filter tabs where needed, `tablePanel` + pagination from `campaigns.module.scss` / `paymentAudits.module.scss`.

**Locked report:** same layout with upgrade panel replacing table (campaigns `upgradePanel`).

### Navigation

| Item | Location |
|------|----------|
| Reports hub | `/reports` (sidebar, always on for subscribed tenants) |
| Report detail | `/reports/[slug]` |
| Payment workflow | `/billing/payment-audits` (unchanged; linked from Field check tracking) |
| Billing hub | No duplicate report list — single link “View all reports →” optional on billing page |

**Design asset:** add mockup `docs/design/portal-mockups/15-tenant-reports.png` during implementation (reference: `08-tenant-payment-audits.png` for table/filter chrome).

---

## Data architecture

### Sources (today)

| Domain | Tables / libs |
|--------|----------------|
| Invoices & AR | `tenant_invoices`, `lib/billing/outstandingInvoices.ts` |
| Payments | `tenant_invoice_payments` (methods, Stripe fee cols, manual audit cols) |
| Stripe mirrors | `tenant_stripe_payouts`, `tenant_stripe_refunds`, `tenant_stripe_disputes` |
| Visits / crew | `tenant_scheduled_visits`, `tenant_scheduled_visit_assignees` |
| Quotes / services | `tenant_quotes`, `tenant_quote_line_items`, `lib/tenant/quoteTotals.ts` |
| Recurring revenue | `customer_subscriptions`, `service_plans` |
| Locations / tax situs | `tenant_customer_properties` (city, state, postal_code) |
| Team | `tenant_memberships`, `user_profiles` |

### Schema prerequisites (by phase)

| Change | Phase | Purpose |
|--------|-------|---------|
| `report_runs` table + RLS | 1 | Cache heavy queries; export metadata |
| `report_exports` Storage bucket | 1 | PDF cache |
| Index `(tenant_id, recorded_at)` on payments | 1 | Date-range report performance |
| `stripe_payout_id` on `tenant_invoice_payments` + webhook backfill | 1.5 | Payout-grouped reconciliation |
| `labor_cost_per_hour` on `user_profiles` or team extension | 1.5 | Employee labor cost column |
| `tax_cents` + `property_id` on invoices (or payment snapshot) | 2 | Credible sales tax report |
| `compensation_rules` | 2 | Tips / commissions |
| Extend `audit_log_entries` for invoice/payment lifecycle | 2 | Chain-of-custody links on exports |
| `bank_links`, `bank_transactions`, `payment_match_suggestions` | 2 | Plaid reconciliation |
| Invoice line items ↔ quote lines | 2+ | Cash revenue by service |

### `report_runs` (proposed migration `0034_report_runs.sql`)

```sql
-- Conceptual
report_runs (
  id uuid primary key,
  tenant_id uuid not null references tenants(id),
  report_slug text not null,
  params jsonb not null,           -- { from, to, filters }
  status text not null,            -- pending | ready | failed
  result_json jsonb,
  row_count int,
  csv_storage_path text,
  pdf_storage_path text,
  expires_at timestamptz,
  created_by_user_id uuid,
  created_at timestamptz default now()
);
```

RLS: tenant members read; writes via service role or secured server actions. TTL default **60 minutes** for `result_json`; Storage objects **7 days**.

---

## Export architecture

| Format | Phase 1 approach | Phase 2+ |
|--------|------------------|----------|
| **CSV** | `GET /api/tenant/reports/[runId]/export.csv` — generate from `result_json` or re-query; `Content-Disposition: attachment` | Same |
| **PDF** | Queue `report_runs.status = pending`; render with **pdfkit** (serverless-safe); upload to Storage; poll/download | Email link via Resend optional |

Shared helper: `lib/reports/toCsv.ts` — column defs co-located with each report query so UI table and export match.

**Rate limit:** reuse `lib/security/rateLimit.ts` on export routes.

---

## Relationship to existing surfaces

| Surface | Role |
|---------|------|
| **Dashboard** (`/`) | Point-in-time KPIs only — no date picker, no export. Do not duplicate full reports. |
| **Payment audits** (`/billing/payment-audits`) | Operational queue — mark received/deposited. Stays in Billing. |
| **Field check tracking report** | Read-only + export; deep-links to Payment audits for actions. |
| **Transactions** (`/billing/transactions`) | Raw ledger list — reports aggregate and explain. |
| **Campaigns metrics** | Stays on Campaigns — not under Reports. |

---

## Implementation phases

### Phase 1 — Foundation (target: first shippable Reports)

1. Migration `0034_report_runs.sql` + Storage bucket `report_exports`.
2. `lib/reports/reportCatalog.ts`, `parseReportDateRange.ts`, `toCsv.ts`.
3. Query modules: `outstandingBalancesReport.ts`, `invoiceAuditReport.ts`, `fieldCheckReport.ts`, `collectionsSummaryReport.ts`, `quotePipelineReport.ts`.
4. UI: hub page, `[slug]/page.tsx`, shared `ReportDateRangeForm`, `ReportTable`, `ReportExportButtons`.
5. CSV export route; PDF stub or Phase 1.1.
6. RBAC: owners/admins run + export; employees/viewers read-only on unlocked reports.

### Phase 1.5 — Pro analytics bundle

1. Payout backfill migration + webhook work.
2. Reports: payment reconciliation, revenue by customer/service, recurring revenue, employee performance.
3. Gate with `assertFeatureEnabled(tier, 'advancedAnalytics')`.

### Phase 2 — Payroll & tax

1. New entitlement keys + `compensation_rules` migration.
2. Sales tax + payroll export reports.
3. Plaid tables (if shipped) → bank reconciliation report.

### Phase 3 — Year-end pack

1. 1099 / fee / customer concentration reports.
2. Cohort/LTV under `forecasting`.
3. Audit log extension + export row hyperlinks.

---

## Testing checklist

- Starter can run Phase 1 reports and export CSV.
- Business blocked on Pro analytics slugs (upgrade panel).
- Pro runs full Phase 1.5 bundle.
- Every query scoped with `.eq('tenant_id', membership.tenantId)`.
- Masquerade exports only target tenant data.
- Empty states: no data in range, Connect incomplete (card sections), missing property on tax report (Phase 2 warning).

---

## Related docs

- `.cursor/docs/plan/implementation-plan.md` — Concern #4, §17 accounting columns
- `docs/billing/tier-entitlements.md` — gate enforcement contract
- `docs/product/email-campaigns.md` — reference gating UX pattern
- `app/tenant/billing/payment-audits/` — date filter + table reference implementation
