# Tenant Reports — design & implementation plan

One-stop reporting for cleaning businesses: day-to-day operations, monthly bookkeeping close, payroll inputs, and year-end tax prep. Reports live at **`/reports`** (top-level tenant nav). Operational **payment workflows** (mark received / deposited) stay under **`/billing/payment-audits`**.

**Status (2026-05):** Phases **1**, **1.5**, **2**, and **3 (baseline)** are implemented — **20 report slugs**. Remaining polish: richer cohort/LTV modeling, optional reports mockup (see [Implementation status](#implementation-status) below).

**Migrations:** `supabase/migrations/0034_report_runs.sql`, `supabase/migrations/0035_reports_phase2.sql`

**Code:** `app/tenant/reports/`, `lib/reports/`, `app/api/tenant/reports/export/`

---

## Goals

1. **Owner / office manager** — see cash, jobs, and collections without exporting to spreadsheets daily.
2. **Bookkeeper / accountant** — reconcile card payouts, offline checks, and open AR with CSV/PDF exports and date filters.
3. **Payroll** — hours and labor cost rollups exportable to ADP / Gusto / QuickBooks (Phase 2).
4. **Year-end** — 1099-relevant customer totals, processing-fee deductions, audit trail links (Phase 3).

Reports are **read-only analytics**. Mutations (mark check deposited, record payment) remain on Billing and Schedule.

---

## Audiences & cadence

| Audience           | Typical cadence                | Needs                                                                 |
| ------------------ | ------------------------------ | --------------------------------------------------------------------- |
| **Office manager** | Daily / weekly                 | Schedule completions, field cash/checks in limbo, overdue AR calls    |
| **Owner**          | Weekly / monthly               | Revenue mix, crew utilization, quote pipeline, MRR                    |
| **Accountant**     | Monthly / quarterly / year-end | Invoice audit, reconciliation by method, aging, sales tax, fee totals |

Each report page ships with **suggested default ranges** (Today, Last 7 days, MTD, Last month, YTD, Custom) via URL `from` / `to` params — same pattern as `/billing/payment-audits`.

---

## Report catalog

### Phase 1 — Core (MVP)

| Slug                   | Title                           | Default range | Primary data                                          | Tier gate     |
| ---------------------- | ------------------------------- | ------------- | ----------------------------------------------------- | ------------- |
| `outstanding-balances` | Outstanding balances (AR aging) | As of today   | `tenant_invoices`                                     | **All tiers** |
| `invoice-audit`        | Invoice audit                   | Last month    | `tenant_invoices`, `tenant_invoice_payments`          | **All tiers** |
| `field-check-tracking` | Field check tracking            | Last 30 days  | `tenant_invoice_payments` (check + manual audit cols) | **All tiers** |
| `collections-summary`  | Collections summary             | Last 7 days   | Payments + invoices                                   | **All tiers** |
| `quote-pipeline`       | Quote pipeline                  | Last 30 days  | `tenant_quotes`, line items                           | **All tiers** |

**Outstanding balances** — open invoices grouped by customer with buckets **0–30 / 31–60 / 61–90 / 90+** days (extends `lib/billing/outstandingInvoices.ts`).

**Invoice audit** — every invoice in range: status, customer, issued/due/paid dates, days outstanding, total, amount paid, payment methods used.

**Field check tracking** — read-only view of check payments with check # (from `notes` today), amount, customer, invoice, days outstanding, audit stage (`awaiting_receipt` → `awaiting_deposit` → `complete`). Links to **Payment audits** for actions.

**Collections summary** — cash collected in period by method (card / cash / check / Zelle / ACH / other), refunds, net collected.

**Quote pipeline** — counts and $ by status (`draft`, `sent`, `accepted`, …); optional line-item mix preview.

### Phase 1.5 — Growth analytics (Pro)

Requires `advancedAnalytics` (`lib/billing/entitlements.ts` — **Pro only** today).

| Slug                     | Title                   | Primary data                                       | Notes                                                                                      |
| ------------------------ | ----------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `payment-reconciliation` | Payment reconciliation  | `tenant_invoice_payments`, `tenant_stripe_payouts` | Group by method; card section groups by payout when `stripe_payout_id` backfill exists     |
| `revenue-by-customer`    | Revenue by customer     | Paid invoices / payments in range                  | Top customers, concentration                                                               |
| `revenue-by-service`     | Revenue by service      | `tenant_quote_line_items` + accepted quotes        | Free-text `service_label` normalization; cash attribution limited until invoice line items |
| `recurring-revenue`      | Recurring revenue (MRR) | `customer_subscriptions` ⋈ `service_plans`         | Accrual MRR; normalize week/year → monthly                                                 |
| `employee-performance`   | Employee performance    | Visits ⋈ assignees                                 | Jobs completed, scheduled hours, completion rate                                           |

**Employee performance (basic):** hours from `ends_at - starts_at` on assigned completed visits; jobs completed count; optional **labor cost** when `labor_cost_per_hour` exists on team profile (see Schema prerequisites).

### Phase 2 — Payroll, tax, ops (baseline shipped)

| Slug                  | Title                       | Gate                                  | Notes                                                                                  |
| --------------------- | --------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------- |
| `sales-tax-summary`   | Sales tax by jurisdiction   | `salesTaxSummary` (**Business+**)     | Accepted quotes + property state/ZIP; tax from `computeQuoteTotals` / quote `tax_mode` |
| `payroll-export`      | Payroll export              | `payrollExports` (**Business+**)      | Hours per employee; CSV export with generic, ADP, Gusto, or QuickBooks column layouts  |
| `tips-commissions`    | Tips & commissions          | `jobCosting` (**Business+**)          | Lists `compensation_rules` (manage at Settings → Compensation); payout math deferred   |
| `crew-utilization`    | Crew utilization            | `advancedAnalytics` (**Pro**)         | Scheduled hours vs 40h/week × weeks in range                                           |
| `on-time-arrival`     | On-time arrival             | `advancedAnalytics` (**Pro**)         | `checked_in_at` vs `starts_at` with 15-minute grace                                    |
| `bank-reconciliation` | Bank deposit reconciliation | `plaidReconciliation` (**Business+**) | `bank_transactions`, match suggestions, CSV import fallback                            |

### Phase 3 — Year-end & strategic

| Slug                         | Title                        | Gate                              | Notes                                                 |
| ---------------------------- | ---------------------------- | --------------------------------- | ----------------------------------------------------- |
| `year-end-revenue`           | Year-end revenue & fees      | `advancedAnalytics`               | Sum gross, Stripe fees, net; per customer 1099 inputs |
| `customer-1099-prep`         | 1099 prep by customer        | `advancedAnalytics`               | Threshold flagging                                    |
| `processing-fees-deductible` | Processing fees (deductible) | All tiers (basic) or Pro (detail) | `stripe_fee_cents` rollup                             |
| `cohort-ltv-churn`           | Cohort / LTV / churn         | `forecasting`                     | Pro only                                              |

---

## Tier gating matrix (canonical for build)

Align with `lib/billing/entitlements.ts`. **Starter gets real reports**, not an empty hub — basic bookkeeping is table-stakes for a cleaning business.

| Capability                             | Starter | Business                    | Pro                         |
| -------------------------------------- | ------- | --------------------------- | --------------------------- |
| Reports hub + Phase 1 core (5 reports) | Yes     | Yes                         | Yes                         |
| CSV export (all implemented reports)   | Yes     | Yes                         | Yes                         |
| PDF export (all implemented reports)   | Yes     | Yes                         | Yes                         |
| Phase 1.5 analytics bundle             | No      | No                          | Yes (`advancedAnalytics`)   |
| Sales tax summary                      | No      | Yes (`salesTaxSummary`)     | Yes                         |
| Payroll export report                  | No      | Yes (`payrollExports`)      | Yes                         |
| Tips & commissions (rules directory)   | No      | Yes (`jobCosting`)          | Yes                         |
| Crew utilization + on-time arrival     | No      | No                          | Yes (`advancedAnalytics`)   |
| Plaid bank match reports               | No      | Yes (`plaidReconciliation`) | Yes (`plaidReconciliation`) |
| Cohort / forecasting (Phase 3)         | No      | No                          | Yes (`forecasting`)         |

**Enforcement pattern** (mirror email campaigns):

1. `lib/reports/reportCatalog.ts` — slug → title, description, phase, `ReportGate`.
2. `isReportEnabled(tier, slug)` / `assertReportEnabled(tier, slug)` on run + export.
3. Hub shows **all** report cards; locked cards use upgrade panel → `/billing`.
4. Deep links to locked reports: upgrade panel (not `404`).
5. **Reports nav always visible** for subscribed tenants (unlike campaigns on Starter).

**`EntitlementFeature` keys in `lib/billing/entitlements.ts`:**

- `salesTaxSummary` — Business & Pro (sales tax report)
- `payrollExports` — Business & Pro (payroll export report)
- `advancedAnalytics` — Pro (Phase 1.5 bundle + crew utilization + on-time arrival)
- `jobCosting` — Business & Pro (tips & commissions rules report)
- `plaidReconciliation` — Business & Pro (bank deposit reconciliation report)

**Not gated by Connect:** cash/check/Zelle reports work without Stripe Connect. Card reconciliation sections show “Connect not set up” empty state when `stripe_connect_status !== 'complete'`.

---

## Roles

| Role     | View reports | Run / refresh | Export CSV/PDF |
| -------- | ------------ | ------------- | -------------- |
| Owner    | Yes          | Yes           | Yes            |
| Admin    | Yes          | Yes           | Yes            |
| Employee | Yes          | No            | No             |
| Viewer   | Yes          | No            | No             |

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

| Item             | Location                                                                             |
| ---------------- | ------------------------------------------------------------------------------------ |
| Reports hub      | `/reports` (sidebar, always on for subscribed tenants)                               |
| Report detail    | `/reports/[slug]`                                                                    |
| Payment workflow | `/billing/payment-audits` (unchanged; linked from Field check tracking)              |
| Billing hub      | No duplicate report list — single link “View all reports →” optional on billing page |

**Design asset:** add mockup `docs/design/portal-mockups/15-tenant-reports.png` during implementation (reference: `08-tenant-payment-audits.png` for table/filter chrome).

---

## Data architecture

### Sources (today)

| Domain                | Tables / libs                                                              |
| --------------------- | -------------------------------------------------------------------------- |
| Invoices & AR         | `tenant_invoices`, `lib/billing/outstandingInvoices.ts`                    |
| Payments              | `tenant_invoice_payments` (methods, Stripe fee cols, manual audit cols)    |
| Stripe mirrors        | `tenant_stripe_payouts`, `tenant_stripe_refunds`, `tenant_stripe_disputes` |
| Visits / crew         | `tenant_scheduled_visits`, `tenant_scheduled_visit_assignees`              |
| Quotes / services     | `tenant_quotes`, `tenant_quote_line_items`, `lib/tenant/quoteTotals.ts`    |
| Recurring revenue     | `customer_subscriptions`, `service_plans`                                  |
| Locations / tax situs | `tenant_customer_properties` (city, state, postal_code)                    |
| Team                  | `tenant_memberships`, `user_profiles`                                      |

### Schema prerequisites (by phase)

| Change                                                             | Phase | Purpose                              |
| ------------------------------------------------------------------ | ----- | ------------------------------------ |
| `report_runs` table + RLS                                          | 1     | Cache heavy queries; export metadata |
| `report_exports` Storage bucket                                    | 1     | PDF cache                            |
| Index `(tenant_id, recorded_at)` on payments                       | 1     | Date-range report performance        |
| `stripe_payout_id` on `tenant_invoice_payments` + webhook backfill | 1.5   | Payout-grouped reconciliation        |
| `labor_cost_per_hour` on `user_profiles` or team extension         | 1.5   | Employee labor cost column           |
| `tax_cents` + `property_id` on invoices (or payment snapshot)      | 2     | Credible sales tax report            |
| `compensation_rules`                                               | 2     | Tips / commissions                   |
| Extend `audit_log_entries` for invoice/payment lifecycle           | 2     | Chain-of-custody links on exports    |
| `bank_links`, `bank_transactions`, `payment_match_suggestions`     | 2     | Plaid reconciliation                 |
| Invoice line items ↔ quote lines                                   | 2+    | Cash revenue by service              |

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

| Format  | Phase 1 approach                                                                                                          | Phase 2+                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **CSV** | `GET /api/tenant/reports/[runId]/export.csv` — generate from `result_json` or re-query; `Content-Disposition: attachment` | Same                           |
| **PDF** | Queue `report_runs.status = pending`; render with **pdfkit** (serverless-safe); upload to Storage; poll/download          | Email link via Resend optional |

Shared helper: `lib/reports/toCsv.ts` — column defs co-located with each report query so UI table and export match.

**Rate limit:** reuse `lib/security/rateLimit.ts` on export routes.

---

## Relationship to existing surfaces

| Surface                                        | Role                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Dashboard** (`/`)                            | Point-in-time KPIs only — no date picker, no export. Do not duplicate full reports. |
| **Payment audits** (`/billing/payment-audits`) | Operational queue — mark received/deposited. Stays in Billing.                      |
| **Field check tracking report**                | Read-only + export; deep-links to Payment audits for actions.                       |
| **Transactions** (`/billing/transactions`)     | Raw ledger list — reports aggregate and explain.                                    |
| **Campaigns metrics**                          | Stays on Campaigns — not under Reports.                                             |

---

## Implementation status

### Shipped

| Area                         | Details                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Phase 1**                  | Hub (`app/tenant/reports/page.tsx`), 5 core reports, hub KPIs (`hubMetrics.ts`)                                             |
| **Phase 1 polish**           | `report_runs` cache (`reportRunCache.ts`), date presets (7d/MTD/YTD), pagination (`ReportPagination.tsx`), CSV + PDF export |
| **Phase 1.5**                | Payment reconciliation, revenue by customer/service, MRR, employee performance                                              |
| **Phase 2 baseline**         | Sales tax, payroll export (generic + ADP/Gusto/QBO CSV), tips/commissions, crew utilization, on-time arrival                |
| **Phase 2 polish**           | `stripe_payout_id` + payout backfill; compensation rules UI + payout math on payroll/tips                                   |
| **Phase 3 baseline**         | Processing fees (all tiers), year-end revenue, 1099 prep (Pro), cohort/LTV (Pro `forecasting`)                              |
| **Bank reconciliation**      | `bank-reconciliation` report, `plaidReconciliation` entitlement, CSV import fallback on bank connection                     |
| **Chain-of-custody exports** | `tenant_payment_events` log; field check + invoice audit CSV/PDF link columns                                               |
| **PDF cache**                | `report_exports` Storage keyed by `report_runs.id` on PDF export                                                            |
| **Payout backfill cron**     | Weekly `/api/cron/backfill-stripe-payout-links` for historical batches                                                      |
| **RBAC**                     | `lib/tenant/reportPermissions.ts` — owners/admins export; employees/viewers read unlocked reports                           |

### Remaining

- Richer cohort/LTV modeling (beyond baseline retention curves)
- Mockup `docs/design/portal-mockups/15-tenant-reports.png` (optional)
- Manual QA: masquerade export scoping

### Key files

```
app/tenant/reports/
  page.tsx                    # Hub + KPI strip
  [slug]/page.tsx             # Run page (cache, export, pagination)
  ReportDateRangeForm.tsx
  ReportResultTable.tsx
  ReportPagination.tsx
  ReportSummaryStrip.tsx
app/api/tenant/reports/export/
  route.ts                    # CSV
  pdf/route.ts                  # PDF
lib/reports/
  reportCatalog.ts            # Slugs, gates, hub sections
  runReport.ts                # Dispatcher (15 slugs)
  reportRunCache.ts           # 60m TTL cache
  *Report.ts                  # Per-report query modules
  exportCsv.ts / renderReportPdf.ts
```

---

## Implementation phases (historical checklist)

### Phase 1 — Foundation ✅

1. ~~Migration `0034_report_runs.sql` + Storage bucket `report_exports`.~~
2. ~~`reportCatalog`, `parseReportDateRange`, `toCsv`, five core query modules.~~
3. ~~UI hub + `[slug]` + `ReportDateRangeForm` + `ReportResultTable`.~~
4. ~~CSV export; PDF via pdfkit; RBAC.~~

### Phase 1.5 — Pro analytics bundle ✅

1. ~~Five Pro reports + `advancedAnalytics` gate.~~
2. ~~Payout backfill migration + webhook (`0036`, `payout.paid`).~~

### Phase 2 — Payroll & tax (partial ✅)

1. ~~`salesTaxSummary` / `payrollExports` entitlements + `0035_reports_phase2.sql` (`compensation_rules`).~~
2. ~~Five Phase 2 report slugs live.~~
3. ~~Provider payroll formats, rules UI, Plaid bank report, and CSV import fallback.~~

### Phase 3 — Year-end pack (baseline ✅)

1. ~~Processing fees, year-end revenue, 1099 prep, cohort/LTV reports.~~
2. ~~Payment event log + export row link columns for chain-of-custody.~~

---

## Testing checklist

- [x] Starter runs Phase 1 reports and exports CSV/PDF.
- [x] Business blocked on Pro-only slugs (upgrade panel); can run sales tax + payroll when entitled.
- [x] Pro runs Phase 1.5 + crew utilization + on-time arrival.
- [x] Queries scoped with `.eq('tenant_id', membership.tenantId)`.
- [ ] Masquerade exports only target tenant data (verify manually).
- [x] Sales tax warns when accepted quotes lack property state.
- [ ] Connect incomplete empty state on card-heavy reconciliation sections (when payout backfill ships).

---

## Related docs

- `.cursor/docs/plan/implementation-plan.md` — Concern #4, §17 accounting columns
- `docs/billing/tier-entitlements.md` — gate enforcement contract
- `docs/product/email-campaigns.md` — reference gating UX pattern
- `app/tenant/billing/payment-audits/` — date filter + table reference implementation
