---
name: find-new-clients
description: >-
  Research and build outreach lists of residential and commercial cleaning
  companies by geography for Clean Scheduler founder outreach. Use when the
  user asks to find cleaning companies, build a prospect CSV, expand into a
  new city/county/metro, or prepare mail-merge contacts for admin Outreach.
---

# Find new cleaning-company clients

Build high-quality prospect lists of **owner-operated residential and commercial cleaning companies** in a target geography, then export a mail-merge CSV ready for Clean Scheduler **admin Outreach** (`/outreach/new`).

Reference implementation: `outreach/swfl-cleaning-outreach-mailmerge.csv` (SWFL — Lee, Collier, Charlotte counties, FL).

## When to use

- User names a city, county, metro, or state and wants cleaning-company leads
- User wants a new outreach CSV / Google Sheet for cold email
- User asks to avoid duplicates against a prior list or campaign

## Goal

Produce a CSV (and optional Sheet) of real local cleaning businesses with:

1. Verified contact channels (prefer email)
2. Geography fields for area tracking (`City`, `County`, `State`)
3. Per-row personalized `Subject` + `Body` (no signature — app appends that)
4. Clear channel when email is missing (`Phone` / `Website form`)

## Inputs to collect first

Ask only if missing:

1. **Geography** — city and/or county list + state (e.g. “Naples + Collier County, FL”)
2. **Segment** — residential, commercial, or both (default: both, prefer owner-operated)
3. **Target count** — e.g. 40–60 emailable contacts
4. **Exclude list** — prior CSV path, Sheet URL, or “skip anyone already in outreach”
5. **Sender identity** — name, phone, offer framing (default: Chris Kendig / Clean Scheduler / feedback + 10% for life)

## Research process

### 1. Define the map

- Resolve cities → counties → state
- Prefer **owner-operated / local** shops over national franchises (Merry Maids mega-franchises, etc.) unless user wants franchises
- Cap franchise chains; note franchisees only when clearly local operators

### 2. Find candidates

Search and cross-check multiple sources (do not invent emails or phones):

- Google Maps / local pack: “house cleaning {city}”, “commercial cleaning {city}”, “office cleaning {county}”
- Company websites (About / Contact / Service area)
- BBB, Yelp, Angi, Thumbtack, Facebook business pages (secondary)
- County / city business directories when useful

For each candidate capture:

| Field | Notes |
| --- | --- |
| Business Name | Legal or DBA as shown publicly |
| Owner Name | First name when findable; else `Unknown` |
| Email | Public contact / info / owner email only — never guess |
| Phone | Primary business line |
| City / County / State | Service HQ or primary city; always fill State |
| Type | `Residential`, `Commercial`, or `Both` |
| Website | Canonical https URL |
| Notes | Why relevant (years in market, eco, bilingual, etc.) |

### 3. Qualify

Include when most of these are true:

- Actively serves the target geography
- Looks like a cleaning **company** (not a solo one-off handyman unless they brand as cleaning)
- Has at least one outreach path: email, phone, or website form
- Not an obvious duplicate of another row (normalize name + phone + domain)

Exclude:

- Janitorial giants / national brands without a local operator identity (unless requested)
- Staffing agencies, maid apps, or marketplaces posing as a single company
- Dead sites / permanently closed listings
- Rows with no contact path at all

### 4. Contact enrichment

- Prefer **email** → set `Has Email` = `Yes`, `Outreach Channel` = `Email`
- No email but phone → `Has Email` = `No`, `Outreach Channel` = `Phone`
- Form-only → `Outreach Channel` = `Website form`
- Never fabricate `@gmail` / `@domain` addresses
- Owner first name: use on “Hi {Name},” when known; else “Hi there,”

### 5. Deduplicate

Before finalizing:

- Same email → keep one
- Same phone + similar name → keep one
- Same website domain → keep one
- If user provided a prior list, drop overlaps by email / phone / domain

## Mail-merge copy (required for Outreach import)

Admin Outreach requires **Email + Subject + Body** for sendable rows. Phone-only rows may still be listed with empty Subject/Body for CRM-style tracking, or omitted from email campaigns — prefer including them with Notes for call follow-up.

### Subject patterns (vary; keep short)

- `Running a cleaning company in {City} — 2-minute ask`
- `Quick question for {Business Name}`
- `Not a sales pitch — feedback ask for {Business Name}`

### Body structure (no signature)

Keep the personal message only. **Do not** append “Thanks for reading,” name, title, company, email, or phone — the app campaign signature handles that.

Recommended arc:

1. Greeting (`Hi {Owner},` or `Hi there,`)
2. Respect inbox / keep it short
3. Who you are + Clean Scheduler in one breath (scheduling for residential/commercial cleaning — crews, quotes, payments)
4. Why **this geography** (county/city) and why **owner-operated** feedback matters
5. One specific observation about **their** business (service area, years, niche) — not generic flattery
6. Soft ask: try it briefly, honest feedback; optional lifetime 10% if they stay (only if user still wants that offer)
7. Easy out + reply / call-text CTA with sender phone

Tone: peer-to-peer, not SaaS marketing. No pitch decks, no emoji spam, no fake “I loved your blog” lines.

### Signature reminder

CSV `Body` ends after the CTA. Signature (logo, name, title, company, contact) is configured on the Outreach campaign in-app.

## Output CSV schema

Write to `outreach/{geo-slug}-cleaning-outreach-mailmerge.csv` (gitignored locally is fine; do not commit PII lists unless user asks).

**Required columns (exact headers preferred):**

```text
Business Name, Owner Name, Email, Phone, City, County, State, Type, Website, Has Email, Outreach Channel, Subject, Body, Notes
```

Rules:

- Quote fields; preserve multiline `Body`
- `State` = 2-letter code when US (e.g. `FL`)
- `Type` ∈ `Residential` | `Commercial` | `Both`
- `Has Email` ∈ `Yes` | `No`
- `Outreach Channel` ∈ `Email` | `Phone` | `Website form`
- Compatible with admin import + published Google Sheet CSV (`/pub?output=csv`)

## Quality bar (before delivering)

- [ ] Every row has City + County + State when knowable
- [ ] No invented emails
- [ ] Emailable rows have Subject + Body
- [ ] Bodies have no pasted signature block
- [ ] Mix of Residential / Commercial / Both reflects the market (don’t force commercial if thin)
- [ ] Deduped against prior list if provided
- [ ] Short summary for the user: counts by county, by Type, by channel (Email vs Phone)

## Example summary to return

```text
Geography: Lee / Collier / Charlotte, FL
Total: 50 | Email: 38 | Phone: 10 | Form: 2
Type: Both 35 · Residential 11 · Commercial 4
Counties: Lee 25 · Collier 13 · Charlotte 12
File: outreach/swfl-cleaning-outreach-mailmerge.csv
Next: import via /outreach/new (file or published Sheet URL); set campaign signature before queue send
```

## Related product context

- Import + send: admin Outreach (`docs/product/platform-outreach.md`)
- Area tracking uses `City`, `County`, `State` on recipients
- Do not put cold prospects into tenant marketing campaigns (those are opted-in customers only)
