# Quotes: multi-line services (product spec)

This document describes how **tenant quotes** combine a header row (`tenant_quotes`) with optional **line items** (`tenant_quote_line_items`). It is written for engineers and can be trimmed for end-user help later.

## Data model

- **`tenant_quotes.amount_cents`**: Stored **total** the customer and lists see: after **line-level discounts**, **quote-level discount**, and **exclusive tax** (when enabled). When there are **no line items**, the subtotal comes from the optional header **amount** field before quote discount and tax. See **Total math** below.
- **`tenant_quotes` pricing columns** (`0019_quote_tax_discount.sql`):
  - `tax_mode` (`quote_tax_mode`: `none` | `exclusive`) — exclusive means tax is **added on top** of the discounted subtotal.
  - `tax_rate_bps` — rate in **basis points** (10_000 = 100%); UI collects a percent string and converts.
  - `quote_discount_kind` (`quote_discount_kind`: `none` | `percent` | `fixed_cents`).
  - `quote_discount_value` — if `percent`, stored as **bps**; if `fixed_cents`, stored as **cents** off the subtotal.
- **`tenant_quote_line_items`**: Zero or more rows per quote. Each row has:
  - `service_label` (required, free text — “what we are pricing”).
  - `frequency` (`quote_line_frequency` enum: `one_time`, `weekly`, `biweekly`, `monthly`, `custom`).
  - `frequency_detail` (optional text; **required when `frequency` is `custom`** to describe the cadence in plain language).
  - `amount_cents` (non-negative integer; **list** price for the line in the quote’s currency — see **Currency** below).
  - `line_discount_kind` / `line_discount_value` (`quote_line_discount_kind` + value: bps for percent, cents off for `fixed_cents`).
  - `sort_order` (integer; row order from the form).

Migrations: `0016_quote_line_items.sql` (lines), `0017_quote_acceptance_versioning.sql` (acceptance snapshot, lock, versioning columns, transactional save RPC), `0018_tenant_operational_settings.sql` (per-tenant workflow + payment-method allow list), **`0019_quote_tax_discount.sql` (tax + quote-level + line-level discounts; snapshot + RPC extended)**.

**Versioning (`tenant_quotes`)**: `quote_group_id` groups all revisions; `version_number` orders them; `version_reason` documents why a new row exists (required in UI when creating an amendment from an accepted quote); `supersedes_quote_id` / `superseded_by_quote_id` link the chain. **Acceptance**: `is_locked`, `accepted_at`; `tenant_quote_acceptance_snapshots` stores a JSON payload (header fields including tax/discount + `line_items` with per-line discount fields) at the first transition to `accepted`.

**Tenant operational settings** (`0018`): quote-accept workflow preference, invoice expectation, and customer payment method allow list — **wiring** into auto-schedule, invoices, and **enforcing `allowed_customer_payment_methods` on customer acceptance** is still TODO.

## Total math (implemented)

Order of operations matches `computeQuoteTotals` in `lib/tenant/quoteTotals.ts`:

1. **Subtotal after line discounts** — each line’s list `amount_cents` minus that line’s discount (percent then fixed).
2. **Quote-level discount** — applied to that subtotal (percent then fixed cents).
3. **Tax** — if `tax_mode` is `exclusive` and `tax_rate_bps` > 0, tax is computed on the amount **after** quote discount and **added** to the total.

Header-only quotes (no lines): the optional header dollar amount is the pre-discount subtotal; steps 2–3 still apply.

## Form contract (tenant portal)

The client posts **parallel arrays** (same field names repeated in DOM order). The parser is `parseQuoteLineItemsFromForm` in `lib/tenant/quoteLineItemsForm.ts`:

| Field name | Meaning |
|------------|---------|
| `line_service` | Service label |
| `line_frequency` | Enum value string |
| `line_frequency_detail` | Detail (required if frequency is `custom`) |
| `line_amount` | Dollars as decimal string — **list** amount for that line |
| `line_discount_kind` | `none` \| `percent` \| `fixed_cents` |
| `line_discount_input` | Percent or dollars string depending on kind |

**Header pricing** (`QuoteHeaderPricingFields`): `quote_tax_mode`, `quote_tax_rate_percent`, `quote_discount_kind`, `quote_discount_percent`, `quote_discount_dollars`.

Completely blank rows (empty service, empty amount, no line discount) are **skipped**. If any non-blank row is invalid, the server returns an error and nothing is persisted for that request.

The UI implementation is `QuoteLineItemsEditor` (`app/tenant/quotes/QuoteLineItemsEditor.tsx`). For non-`custom` cadences, the cadence detail control stays in the DOM but is visually hidden and cleared so array indices stay aligned with `getAll()`.

## Server rules (`app/tenant/quotes/actions.ts`)

- **Create**: Insert the quote (including tax/discount columns and computed `amount_cents`), then insert line items. If line insert fails, the new quote row is deleted (best-effort rollback; not a DB transaction).
- **Update**: Unlocked quotes only: `tenant_quote_save_with_line_items` RPC replaces line items and updates the header (including tax/discount) in **one transaction**. Locked quotes cannot be saved from the tenant form.
- **Amount resolution**: Parsed lines + header pricing feed **`computeQuoteTotals`**; persisted **`amount_cents`** is the resulting **total** (or null when there are no lines, no header amount, and a zero total — same edge case as before).

## Display

- Quote detail loads `tenant_quote_line_items` with the quote and renders a read-only **Services** table when lines exist (**list**, **line discount**, **after discount**).
- Header subtitle uses `formatQuoteMoney(row.amount_cents, row.currency)` — this is the **final** total including tax.

## Customer portal

- **Shipped**: `/customer/quotes` and `/customer/quotes/[id]` — version history, acceptance snapshot line table when present (including discount fields), live line items otherwise, **Accept / Decline** when `status === 'sent'` and the quote is not locked (`app/customer/quotes/actions.ts`, `CustomerQuoteResponseForm.tsx`). Accept/decline uses the admin client with ownership checks; DB triggers still set lock + snapshot on **accept**.
- **Remaining**: optional PDF/email; **payment capture** and enforcing **`allowed_customer_payment_methods`** during acceptance.

## Product decisions (stakeholder input)

### Taxes

- **Tenant choice**: Each tenant decides whether amounts on a quote are **tax-inclusive** or **tax-exclusive** (or otherwise how tax is presented). **Shipped for MVP**: `none` and **exclusive add-on** only (`quote_tax_mode`); inclusive presentation is not a separate mode in schema yet.

### Discounts

- **Flexible model**: **Shipped**: quote-level **and** per-line discounts; kind is **percentage (bps)** or **fixed cents**.
- **Combining rules**: **Implemented**: line discounts first → quote-level discount on that subtotal → exclusive tax on the result.

### Acceptance and versioning

- **Freeze on acceptance**: When the customer **accepts** a quote, that revision is **frozen** (immutable snapshot) because the customer agreed to that version.
- **Amendments**: If the quote must change after acceptance, create a **new version** instead of mutating the accepted snapshot. Both **customer and tenant** retain a **history** of quote versions.
- **Version reason**: Creating a new version after acceptance (or whenever versioning is used for amendments) should require a **mandatory reason** (audit trail and clarity for both sides).

### Operations (scheduling) and tenant settings

- **Tenant-configurable behavior**: Add **tenant-level settings** (or equivalent) so each business can choose:
  - **Auto-scheduling**: Accepted quotes optionally drive automatic creation of visits / schedule entries according to rules you define later, **or**
  - **Prompt workflow**: No auto-schedule; when staff log in they get a **workflow that prompts them** to schedule work for accepted quotes.

### Invoices and payments

- **Tenant policies**: Settings should allow **prepay vs. pay-after** (and similar) so businesses that require payment before work vs. after can both be supported.
- **Methods**: Customers may pay with **cash, check, card**, etc. The **selected method** should be **clearly denoted** (especially for cash/check where there is no card rail).
- **Acceptance phase**: Some payment or payment-intent details may be **collected from the customer during quote acceptance** (design the acceptance UI/API accordingly).
- **Allowed methods per tenant**: Tenants configure **which payment methods they accept**; the customer only sees **those** options during acceptance (and anywhere else payment method is chosen).

### Currency

- **Single currency per quote**: One `currency` on the quote header applies to the whole quote and all line items (no per-line currency).
- **Launch scope**: **USD only** for US-based businesses at initial sale; keep types and copy flexible so **other currencies can be enabled later** without a breaking redesign.

## Known gaps and proposed solutions

These are **not** failures of the current MVP; they are edges and follow-ons called out so engineering and stakeholders share one picture. Where a **product decision** is needed, it is called out explicitly—confirm with product/legal before building.

### 1. `valid_until` vs `expired` status (no automation today)

- **Gap**: `valid_until` is stored and shown, but nothing automatically moves a quote to `expired`, so list/detail can show “Valid until” in the past while `status` is still `draft` or `sent`.
- **Proposed solutions** (pick one primary; others optional):
  - **A — Scheduled mutation (recommended for clean data)**: Daily job (e.g. Supabase **pg_cron**, **Edge Function** on a schedule, or external worker) runs `UPDATE tenant_quotes SET status = 'expired' WHERE status IN ('draft', 'sent') AND valid_until IS NOT NULL AND valid_until < now() AT TIME ZONE 'UTC' AND NOT is_locked` (exact predicate to be refined: e.g. exclude `declined`/`accepted`/`expired` already).
  - **B — Read-time only (“soft expiry”)**: No DB status change; UI shows **“Past valid date”** banner and disables customer Accept / optionally warns tenant. Simpler, but reporting and filters stay “wrong” until A exists.
  - **C — Hybrid**: B for immediate UX + A for canonical status for reporting.
- **Decisions to confirm**: Should **draft** quotes auto-expire or only **`sent`**? After expiry, can staff **re-open** (e.g. back to `draft` with new `valid_until`) or is `expired` terminal? Which **timezone** anchors “end of valid day” (tenant vs UTC)?

### 2. Quote create is not one database transaction

- **Gap**: **Create** path inserts the quote row then inserts line items; on line failure the app deletes the quote (best-effort). A crash between steps can leave an **orphan quote** with no lines, or rare races with concurrent reads.
- **Proposed solutions**:
  - **A — RPC parity with update (recommended)**: Add `tenant_quote_create_with_line_items` (or extend a single “upsert draft” RPC) that inserts header + lines in **one** `plpgsql` transaction, same pattern as `tenant_quote_save_with_line_items`.
  - **B — Defer**: Accept rare orphans; add a **nightly cleanup** job deleting empty draft quotes older than N hours with no lines (strict rules to avoid deleting intentional header-only quotes).
- **Decisions to confirm**: Is **B** acceptable short-term if **A** is scheduled next sprint?

### 3. Quotes with no `customer_id` (customer portal and Accept)

- **Gap**: Customer portal lists/quotes are keyed off **linked customers**. Accept/decline actions require a `customer_id` the logged-in user is allowed to act for. **Internal** quotes (no customer) never appear in the customer app and cannot be accepted there—by design unless we add another channel.
- **Proposed solutions**:
  - **A — Gate at “Send” (recommended)**: Tenant UI requires **customer** (and optionally property) before changing status to **`sent`** or before a **“Notify customer”** action; drafts may stay anonymous.
  - **B — Gate at create**: Stricter—always require customer for any quote that will ever be customer-visible (more friction for exploratory drafts).
  - **C — Future**: **Magic link** or portal invite not tied to `customer_id` row (larger identity model).
- **Decisions to confirm**: **A vs B** for MVP send rules?

### 4. Notifications (sent / accepted / declined)

- **Gap**: No email (or push) when a quote is sent, accepted, or declined; staff and customers discover changes only when they open the app.
- **Proposed solutions**:
  - **A — Event outbox + worker**: Insert `notification_outbox` (or reuse a generic `domain_events` table) on status change via DB trigger or app layer; worker sends via **Resend / SendGrid / SES** with templates and idempotency keys.
  - **B — Direct send from server action**: Simpler for low volume; risk of blocking request and harder retries—acceptable only for very early staging.
  - **C — Tenant toggles**: Respect per-tenant “email on quote accepted” etc. once `tenant_operational_settings` (or a small extension) defines flags.
- **Decisions to confirm**: Minimum **event set** (e.g. `sent` to customer only vs also `accepted` to tenant)? Preferred **vendor**? Do customers without email use **SMS** later?

### 5. Legal / compliance vs technical acceptance record

- **Gap**: Acceptance today is **`status` → `accepted`**, lock, and a **JSON snapshot** in `tenant_quote_acceptance_snapshots`. That is a strong **internal audit** trail but is **not** the same as a regulated **e-signature** product (DocuSign, etc.).
- **Proposed solutions**:
  - **A — Document the policy (do now)**: In customer-facing copy, state that clicking **Accept** constitutes agreement to the **terms and pricing shown**; link to tenant **Terms of service** URL if/when stored.
  - **B — Evidence pack (later)**: PDF generated from snapshot + timestamp + user id for download/email.
  - **C — Third-party e-sign (later)**: Integrate when a customer or insurer requires it.
- **Decisions to confirm**: Is **A** sufficient for first paid customers in your jurisdiction, or does legal require **B/C** before go-live?

### 6. Broader product surface (currency, reporting, prompt workflow UX)

- **Gap**: Spec calls for **multi-currency**, **quote-derived reporting**, and a concrete **“prompt staff”** experience beyond storing `accepted_quote_schedule_mode`—not built yet.
- **Proposed solutions**:
  - **Multi-currency**: Keep `currency` on quotes; gate non-USD in UI until **exchange / formatting** rules exist; avoid hard-coding `$` in new surfaces.
  - **Reporting**: Later **export** (CSV) or **warehouse** sync from `tenant_quotes` + snapshots; optional SQL view for “accepted value by month”.
  - **Prompt staff**: Tenant **queue** view—`status = accepted` AND no linked `tenant_scheduled_visits` (or whatever rule) when mode is `prompt_staff`; optional in-app task or badge count.
- **Decisions to confirm**: Priority order vs items in **Future implementation backlog** below.

---

**Relationship to backlog**: Items **1–3** in the numbered backlog below are the main **feature** tracks. Gap **1** (expiry), **2** (transactional create), **4** (notifications), and parts of **6** (queue UX) can be **promoted** into that list as engineering picks them up. Gap **3** may become a **small** backlog item (“enforce customer on send”). Gap **5** is mostly **copy + legal** unless you choose **B/C**.

## Future implementation backlog (remaining)

Suggested order is indicative; adjust with engineering.

1. **Tax presentation**: Optional **tax-inclusive** display mode or additional `quote_tax_mode` values if product requires it beyond exclusive add-on.
2. **Customer quotes**: Payment capture / intent at acceptance; **`allowed_customer_payment_methods`** enforcement in UI and server actions; optional PDF/email.
3. **Tenant settings**: Read `tenant_operational_settings` in scheduling, invoicing, and post-accept workflows (`accepted_quote_schedule_mode`, `invoice_expectation`).
4. **From [Known gaps](#known-gaps-and-proposed-solutions)**: Auto-expire job and/or soft-expiry UI (**§1**); transactional **quote create** RPC (**§2**); **customer required before send** (or stricter rule — **§3**); notification pipeline (**§4**); legal copy / PDF / e-sign per decision (**§5**); prompt-staff queue and reporting (**§6**).

## Files touched by this feature

- `supabase/migrations/0016_quote_line_items.sql`
- `supabase/migrations/0017_quote_acceptance_versioning.sql`
- `supabase/migrations/0018_tenant_operational_settings.sql`
- **`supabase/migrations/0019_quote_tax_discount.sql`**
- `lib/tenant/quoteLineFrequency.ts`, `lib/tenant/quoteLineItemsForm.ts`, **`lib/tenant/quoteTotals.ts`**, **`lib/tenant/quoteHeaderPricingForm.ts`**
- `lib/tenant/quoteMoney.ts` (**`formatQuoteLineDiscountShort`**)
- `lib/tenant/quoteEmbedTypes.ts` (`QuoteDetailEmbedRow` includes nested line items)
- `lib/supabase/database.types.ts`
- `app/tenant/quotes/actions.ts`, `QuoteLineItemsEditor.tsx`, **`QuoteHeaderPricingFields.tsx`**, `QuoteCreateForm.tsx`, `QuoteEditForm.tsx`, `QuoteAmendmentForm.tsx`, `[id]/page.tsx`, `page.tsx`, `QuotesBoard.tsx`, `quotes.module.scss`
- `app/customer/quotes/page.tsx`, `app/customer/quotes/[id]/page.tsx`, **`app/customer/quotes/actions.ts`**, **`CustomerQuoteResponseForm.tsx`**, `app/customer/quotes/quotes.module.scss`, `lib/customer/quoteAcceptanceSnapshot.ts`, `app/customer/layout.tsx`, `app/customer/page.tsx`
- `lib/tenant/operationalSettings.ts`, `app/tenant/settings/actions.ts`, `OperationalSettingsForm.tsx`, `app/tenant/settings/page.tsx`, `app/tenant/settings/settings.module.scss`
