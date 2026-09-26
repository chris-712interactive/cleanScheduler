# Tenant customer list import

**Status:** Proposed — Jobber-first, source-profile architecture  
**Audience:** Tenant owners and office staff (`customers.manage`)  
**Related:** Customer CRM (`customer_identities` / `customers` / profiles / properties), owner onboarding checklist, compare pages (`/compare/vs-jobber` and siblings)

Marketing already tells switchers to “import active customers.” There is no tenant CRM import today. This spec is the plan to add one, starting with a real Jobber **Clients** CSV export.

## Purpose

Let a cleaning company leaving a competitor upload that product’s client export and create **customers + service properties** in their workspace — without retyping the book, and without pretending we can ingest every column those exports contain.

v1 is **directory bootstrap**, not a full data migration. Quotes, visits, invoices, recurring rules, and payment methods stay out of scope.

## Why source profiles (not a single generic mapper)

Competitor CSVs do not share a row grain or a header vocabulary:

| Source        | Typical row grain                       | Example headers                                              |
| ------------- | --------------------------------------- | ------------------------------------------------------------ |
| **Jobber**    | One row per **client × property**       | `J-ID`, `E-mails`, `Service Street 1`, `CFT[Door Code…]`     |
| ZenMaid       | Usually one row per **client**          | Client / address / frequency columns (export tier-dependent) |
| Housecall Pro | Client list vs property list may differ | Customer + address columns; sometimes separate property file |
| Launch27      | Client list                             | Name / email / phone / address                               |
| Generic CSV   | Unknown                                 | Owner maps columns in the UI                                 |

A Jobber file treated as “one customer per row” would duplicate the 32 multi-property clients in the sample export (778 rows → 741 people). Profiles encode grain, header fingerprints, and dirty-field heuristics per competitor. Generic mapping is the fallback when we do not recognize the file.

## Sample used for this spec

A production Jobber **Clients** export (not committed — it is customer PII):

| Metric                                    | Count   |
| ----------------------------------------- | ------- |
| Rows / unique `J-ID`s                     | 778     |
| Unique clients (`J-ID` prefix before `_`) | 741     |
| Clients with 2–3 property rows            | 32      |
| Rows with a service street                | 741     |
| Rows with at least one email              | 680     |
| Rows with 2+ emails (comma-separated)     | 145     |
| Rows with a main phone                    | 677     |
| `Archived = true`                         | 0       |
| `Is Company? = true`                      | 1       |
| Non-empty `Company Name`                  | 30      |
| File size                                 | ~230 KB |

That book fits a **synchronous** preview + commit on the server. Starter’s `maxActiveCustomers` is **500**, so this same file would **exceed Starter** and must be stopped in preview with an upgrade path — not partially applied by accident.

## Goals

1. Detect Jobber (and later other) exports from headers and map a **useful subset** into our customer model.
2. Collapse Jobber’s property-per-row grain into one customer with many `tenant_customer_properties`.
3. Show a **preview** (creates / skips / duplicates / plan-limit) before writing.
4. Be **re-runnable**: a second upload of the same Jobber file should not clone customers (`customers.external_ref`).
5. Stay **safe**: no portal invites, no SMS/marketing opt-in, no junk custom fields copied blindly.
6. Leave a plug for ZenMaid, Housecall Pro, Launch27, and a generic mapper without rewriting the wizard.

## Non-goals (v1)

- Importing jobs, visits, quotes, invoices, payments, or recurring schedules
- A live Jobber API sync
- Multiple emails or phones as first-class records (identity has **one** email and **one** phone)
- Customer tags (we do not have a tags table)
- Billing-address fields (we store **service** addresses only)
- Auto-assigning service zones (leave `service_zone_id` null; owner maps later)
- Auto-inviting the customer portal
- Copying Jobber “text message enabled” / reminder flags into `sms_transactional_opt_in` or `marketing_email_opt_in` (those require our own consent capture)
- Admin/founder import of a tenant’s book
- Spreadsheet URL import (file upload only)

## Current model (what we can actually store)

Create stack is the same as `/customers/new`:

`customer_identities` → `customers` → `customer_tenant_links` → `tenant_customer_profiles` → `tenant_customer_properties` (one or more)

| Our field                                     | Required today        | Notes                                |
| --------------------------------------------- | --------------------- | ------------------------------------ |
| `first_name`                                  | Yes                   | Only required field on manual create |
| `last_name`, `email`, `phone`                 | No                    | Single values on the identity        |
| `company_name`, `internal_notes`              | No                    | Profile                              |
| `preferred_contact_method`                    | No                    | `email` \| `phone` \| `sms`          |
| Property address + `label` + `site_notes`     | No                    | Multi-property; one `is_primary`     |
| `property_kind`                               | Default `residential` | `commercial` when we are confident   |
| `customers.external_ref`                      | Unused in UI          | Use for competitor client id         |
| `customers.status`                            | `active` / `inactive` | Map Jobber `Archived`                |
| Portal invite / SMS opt-in / marketing opt-in | Explicit UX           | **Do not set on import**             |

`createTenantCustomer` sends a portal invite when an email is present. Import **must not** reuse that action as-is.

## Jobber export — header inventory

Observed columns (39). **Import** / **skip** is the v1 decision, not “fields we might want someday.”

### Import (mapped)

| Jobber header                                                        | Destination                             | Rule                                                                                                                                                                                      |
| -------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `J-ID`                                                               | Grouping key + `customers.external_ref` | Split `{clientId}_{propertyId}`. Store `jobber:{clientId}`.                                                                                                                               |
| `First Name` / `Last Name`                                           | Identity                                | Trim. If both empty, fall back to `Display Name`, then `Company Name`.                                                                                                                    |
| `Display Name`                                                       | Fallback name only                      | Do not overwrite a real first/last.                                                                                                                                                       |
| `E-mails`                                                            | Identity email + notes                  | Comma-separated. First valid, lowercased email is primary. Extra addresses → `internal_notes`.                                                                                            |
| `Main Phone #s`                                                      | Identity phone                          | Semicolon-separated. First number that normalizes to E.164 (`lib/sms/normalizePhoneNumber.ts`).                                                                                           |
| `Mobile Phone #s` / `Work` / `Home` / `Text Message Enabled Phone #` | Phone fallback                          | Use in that order if main is empty. Do **not** store extras as additional phones.                                                                                                         |
| `Service Property Name`                                              | Property `label`                        | If blank: street, else city, else “Service location”. First property for the client is `is_primary`.                                                                                      |
| `Service Street 1`                                                   | `address_line1`                         | Required to create a property row. Rows with no street are contact-only (customer still created).                                                                                         |
| `Service Street 2`                                                   | `address_line2` **or** `site_notes`     | Unit/suite/`#` → line 2. “gate code”, “alarm”, “key” → `site_notes`.                                                                                                                      |
| `Service City` / `State` / `Zip`                                     | Address                                 | Normalize state via `normalizeUsState` (lift out of `lib/admin/outreachGeoMetrics.ts`). Strip parenthetical junk from zip (`33957 (Gulfside Place)` → `33957`, remainder → `site_notes`). |
| `Is Company?`                                                        | `property_kind` + company               | `true` → `company_name` from `Company Name` or `Display Name`; primary property `commercial`.                                                                                             |
| `Archived`                                                           | `customers.status`                      | `true` → `inactive`. Default **skip archived** in the UI.                                                                                                                                 |
| `CFT[Door Code and Trim Code]`                                       | `site_notes`                            | Only if it does not match a known sentinel (see heuristics).                                                                                                                              |

### Fold into notes (do not map 1:1)

| Jobber header       | Why                                                                                                                                             |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Extra emails/phones | No multi-contact table                                                                                                                          |
| Billing address     | No billing-address columns. If billing street **differs** from service (26 rows in the sample), append a “Billing: …” line to `internal_notes`. |
| `Lead Source`       | Sparse (6 rows). Append to `internal_notes` when present.                                                                                       |
| `Title`             | Mrs./Dr. — skip                                                                                                                                 |
| `Created Date`      | Skip (our `created_at` is import time)                                                                                                          |
| `PFT[office]`       | Rare; append to `site_notes` when non-empty                                                                                                     |
| `CFT[Referred By]`  | Rare; append to `internal_notes` (do not auto-run referral attribution)                                                                         |

### Skip

| Jobber header                                            | Why                                                          |
| -------------------------------------------------------- | ------------------------------------------------------------ |
| `Tags`                                                   | No CRM tags                                                  |
| `Receives automatic visit/job/quote/invoice follow-ups?` | Our reminder engine is separate; sample is almost all `true` |
| `Billing Country` / `Service Country`                    | Assume US; we do not store country on properties             |
| `Fax Phone #s` / `Other Phone #s`                        | Low value                                                    |
| Jobber automations, Client Hub, payments                 | Not in this file and not in v1                               |

### Heuristics the sample forces (do not skip these)

**1. `Company Name` is a junk drawer.** In the sample, 30 rows have a value but only 1 is `Is Company? = true`. Real contents include `Garage 3151 Alarm 0804`, `Gate #1261`, `door code aperta…`, `1328 G`, plus a few actual businesses (`Star Orthopedics`, `Hajoca Corp`, `SYLVAN LEARNING CENTER`).

Use `Company Name` as `company_name` only when:

- `Is Company?` is true, **or**
- The value looks like an organization (`llc`, `inc`, `corp`, `ltd`, `cleaning`, `properties`, `rental`, `center`, `physicians`, `learning`), **and** it does not look like access notes (`garage`, `gate`, `door`, `alarm`, `code`, mostly digits).

Otherwise treat it as `site_notes` on the matching property.

**2. Custom fields are not trustworthy.** `CFT[Door Code and Trim Code]` was filled on **every** row; 777/778 were the sentinel `01137/2016`. Import only values that are not in a small deny-list of repeated placeholders. Jobber `CFT[…]` / `PFT[…]` headers are tenant-defined — v1 Jobber profile handles the two we saw; unknown `CFT`/`PFT` columns are ignored (they can land in a later “dump unmatched to notes” toggle).

**3. Names are messy.** Extra spaces (`Agnas  Gura`), first names that include nicknames (`Ed (Made In Rio)`), last names that start with a space. Collapse internal whitespace. If first name is empty and display name equals company name, use the company as `first_name` so the required-name check passes (e.g. `Hajoca Corp`).

**4. State / zip pollution.** Service state values included `Florida`, `FL`, `Fl`, `Fl.`, and `Florida (Pelican Preserve)`. Zip values included trailing community names. Normalize; leftover text goes to `site_notes`.

## Architecture

```
Upload CSV
    → parse (shared RFC4180 splitter)
    → detect source profile from headers
    → profile.mapRows() → CanonicalImportRow[]  (still one row per CSV line)
    → groupByCustomer() → CustomerImportDraft[] (1 customer + N properties)
    → matchExisting() + validate + plan-limit
    → preview (no writes)
    → commit in batches (no portal invites)
```

### Canonical draft (source-agnostic)

```ts
type CustomerImportDraft = {
  source: 'jobber' | 'zenmaid' | 'housecall_pro' | 'launch27' | 'generic';
  externalRef: string | null; // e.g. jobber:27460423
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null; // E.164 when possible
  companyName: string | null;
  internalNotes: string | null;
  status: 'active' | 'inactive';
  properties: Array<{
    label: string | null;
    kind: 'residential' | 'commercial' | 'short_term_rental' | 'other';
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null; // 2-letter when US
    postalCode: string | null;
    siteNotes: string | null;
    isPrimary: boolean;
  }>;
  warnings: string[]; // extra emails, billing≠service, company-name reclassified, etc.
  skipReason?: 'missing_name' | 'archived' | 'duplicate' | 'invalid';
};
```

### Source profile contract

```ts
type CustomerImportSourceProfile = {
  id: CustomerImportDraft['source'];
  label: string; // "Jobber"
  /** Exact header names (case-insensitive) that strongly identify this export. */
  fingerprintHeaders: string[];
  detect(headers: string[]): boolean;
  mapRows(headers: string[], rows: string[][]): CustomerImportDraft[];
};
```

Jobber `detect`: headers include `J-ID` and (`Service Street 1` or `E-mails`).

ZenMaid / Housecall / Launch27: add profiles later with their real export headers. Until then, unrecognized files use **generic** (manual column map in the wizard).

### File layout (proposed)

| Path                                                   | Role                                                                                                                                     |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/csv/parseCsv.ts`                                  | Shared splitter (today duplicated in outreach + bank-statement parsers)                                                                  |
| `lib/geo/normalizeUsState.ts`                          | Move `normalizeUsState` out of admin outreach                                                                                            |
| `lib/tenant/customerImport/types.ts`                   | Draft + preview + result types                                                                                                           |
| `lib/tenant/customerImport/detectSource.ts`            | Header fingerprint                                                                                                                       |
| `lib/tenant/customerImport/profiles/jobber.ts`         | Grain, map, heuristics                                                                                                                   |
| `lib/tenant/customerImport/profiles/generic.ts`        | Manual / guessed mapping                                                                                                                 |
| `lib/tenant/customerImport/normalize.ts`               | Email, phone, zip, name whitespace                                                                                                       |
| `lib/tenant/customerImport/matchExisting.ts`           | Dedupe vs workspace                                                                                                                      |
| `lib/tenant/customerImport/preview.ts`                 | Counts + plan limit, no writes                                                                                                           |
| `lib/tenant/customerImport/commit.ts`                  | Batched inserts                                                                                                                          |
| `app/tenant/customers/import/`                         | Wizard UI                                                                                                                                |
| `app/tenant/customers/importActions.ts`                | Server actions (`customers.manage`)                                                                                                      |
| `lib/tenant/customerImport/fixtures/jobber.sample.csv` | **Synthetic** Jobber headers + ~8 rows (multi-property, extra emails, junk company name, sentinel door code). Never commit real exports. |

### Deduping

Match order against **this tenant only**:

1. `customers.external_ref` = `jobber:{clientId}`
2. Identity email (normalized), if present
3. Identity phone (E.164) **and** last name, if both present

On match:

- Default: **skip** the customer; still offer **add missing properties** when the incoming service street is not already on that customer (same normalized `address_line1` + `postal_code`).
- Re-import of the same file: 0 new customers, 0 new properties.

Do not merge two existing workspace customers. Do not match across tenants (global identities stay untouched).

### Commit rules

- Permission: `customers.manage` (same as create).
- Entitlement: `assertMeteredLimit(..., 'maxActiveCustomers', newActiveCount)` **before** the first insert. Inactive (archived) rows do not consume the active cap if we import them; default is skip archived.
- Batch inserts (e.g. 50 customers per round-trip) rather than 741 sequential create stacks.
- Always create a primary property row if the customer has ≥1 service street; if none, skip the property insert (identity-only customer, same as a name-only `/customers/new`).
- **Do not** call `ensureCustomerPortalInvite`.
- Leave `sms_transactional_opt_in` and `marketing_email_opt_in` false.
- Completing import with ≥1 active customer satisfies the onboarding `customer` step (`hasCustomers`).

### Limits and size

| Constraint             | v1 value                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------- |
| File types             | `.csv` / `text/csv` / `text/plain`                                                     |
| Max upload             | 5 MB                                                                                   |
| Max data rows          | 10,000                                                                                 |
| Sync path              | OK for books like the sample (~800 rows)                                               |
| Over plan limit        | Preview blocks commit; show remaining capacity + upgrade modal (`UpgradeOrAddOnModal`) |
| Empty file / no header | Hard error                                                                             |

If we later see 10k+ row books, add an async job table. Not needed for Jobber-sized cleaning books.

## User experience

### Entry points

| Surface                                      | Change                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `/customers` header                          | Secondary **Import** next to **Add customer**                                                                             |
| Empty directory                              | Dual CTAs: Add customer / Import from another product                                                                     |
| `/customers/import`                          | Wizard                                                                                                                    |
| `/getting-started`                           | `customer` step detail can mention import; href can stay `/customers/new` or become `/customers` (both complete the step) |
| `/help/cleaning-businesses/import-customers` | Owner how-to (Jobber export steps + what we keep) — ship with the feature, not this plan PR                               |

### Wizard

1. **Source + file** — chips: Jobber (recommended), Generic CSV; other competitors disabled with “coming soon” until their profile exists. File picker. Short Jobber hint: _Clients → Export_ (not jobs/invoices).
2. **Detected mapping** — “This looks like a Jobber client export.” Show mapped fields vs ignored columns. If generic: dropdown per our field (`First name`, `Email`, …). User can override source if detection is wrong.
3. **Options** — Skip archived (on). Duplicate handling: skip existing / add new properties only. Optional: “Include unmatched custom fields in notes” (off).
4. **Preview** — counts: N customers, M properties, D duplicates, S skipped, W warnings. Table of first ~50 drafts (name, email, phone, property count, status). Expandable warnings. Plan-limit banner if `current + new > maxActiveCustomers`.
5. **Result** — created / properties added / skipped. Link back to `/customers`. Errors are per-row, not a silent partial with no summary.

No column is required except a resolvable **name**. Email-less customers are valid (98 named rows in the sample had no email).

## Phased delivery

### Phase 1 — Jobber (this feature)

- Shared CSV parse + Jobber profile + grouping
- Preview + commit
- Directory / empty-state CTAs
- Synthetic fixture tests
- Owner help article + compare-page “Switching from Jobber” sentence once live (do not claim import in marketing until it ships)

### Phase 2 — more source profiles

Add a profile when we have a **real export** (same process as this Jobber file):

1. Inventory headers + row grain + dirty fields
2. Map subset → canonical draft
3. Fingerprint + fixture
4. Enable the chip in the wizard

Priority from existing compare pages: **ZenMaid → Housecall Pro → Launch27 → Swept**. Generic mapper covers anyone else in the meantime.

### Phase 3 — later (separate specs)

- Visit / job import (“next two weeks of work”)
- Recurring rules
- Async import jobs + progress
- Optional `external_ref` on properties (`jobber:{clientId}:{propertyId}`) if we need idempotent property re-import beyond address match

## Testing

Parser tests must use **synthetic** CSVs only.

| Case                                                | Expect                                                |
| --------------------------------------------------- | ----------------------------------------------------- |
| Fingerprint `J-ID` + `Service Street 1`             | Source = jobber                                       |
| Two rows, same client id prefix, two streets        | 1 customer, 2 properties, first primary               |
| `E-mails` with three addresses                      | Primary = first valid; extras in notes                |
| `Company Name` = `Garage 1553`, `Is Company?` false | Not `company_name`; `site_notes`                      |
| `Is Company?` true + company name                   | `company_name` + commercial primary property          |
| Door code `01137/2016`                              | Dropped                                               |
| Door code `Gate (Trade Win) code 1789`              | `site_notes`                                          |
| Zip `33957 (Gulfside Place)`                        | postal `33957`, community in `site_notes`             |
| State `Florida` / `Fl.`                             | `FL`                                                  |
| Missing first+last, display = company               | Customer created with that name                       |
| Missing name entirely                               | Row skipped                                           |
| `Archived` true + skip-archived on                  | Skipped, not counted toward active cap                |
| Re-import same `J-ID` prefix                        | Duplicate skip; no second identity                    |
| New property street on existing `external_ref`      | Property added, customer not cloned                   |
| Preview would exceed `maxActiveCustomers`           | Commit rejected                                       |
| Commit path                                         | No `ensureCustomerPortalInvite`; opt-ins remain false |

Reuse the real export **locally** as a soak test; never check it in.

## Docs to update when Phase 1 ships

| Doc                                                  | Change                                                |
| ---------------------------------------------------- | ----------------------------------------------------- |
| This spec                                            | Status → Implemented                                  |
| `docs/product/owner-onboarding-checklist.md`         | Customer step can be satisfied via import             |
| `lib/marketing/seoContent/helpArticles.ts`           | New owner guide                                       |
| `lib/marketing/seoContent/competitorComparePages.ts` | “Switching from Jobber” — link to `/customers/import` |
| `lib/tenant/permissionCatalog.ts`                    | Description: manage includes import                   |
| `.cursor/docs/plan/implementation-plan.md`           | Mark `tenantCustomerCsvImport` complete               |
| `docs/product/implementation-status-summary.md`      | Handoff note                                          |

## Implementation notes

- Extract the CSV line/row splitters from `lib/admin/parseOutreachCsv.ts` and `lib/plaid/parseBankStatementCsv.ts` so Jobber quoted commas and future competitor files share one parser. Keep outreach/bank `findColumn` behavior unchanged.
- Do not route import through `createTenantCustomer` (invites + single property + FormData).
- `customers.external_ref` is the right idempotency hook; no new table required for v1.
- Prefer lifting `normalizeUsState` to `lib/geo/` over importing admin outreach from tenant code.
- Jobber dates are `dd/mm/yyyy` in the sample; irrelevant until we import `Created Date` (we will not in v1).
