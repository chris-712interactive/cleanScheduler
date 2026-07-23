# Marketing SEO

Developer reference for public-site search optimization on cleanscheduler.com.

## Architecture

- Marketing routes live under `app/marketing/*` and are served at apex paths via `proxy.ts` rewrites (`/pricing` → `/marketing/pricing`).
- `metadataBase` in `app/layout.tsx` uses `getPublicOrigin(null)` → `https://cleanscheduler.com` (non-www apex).
- Shared metadata helper: `lib/marketing/marketingPageMetadata.ts` (`buildMarketingPageMetadata`, `NOINDEX_PAGE_METADATA`, `DEFAULT_OG_IMAGE`).
- Structured data: `lib/marketing/seoJsonLd.ts` — homepage, pricing, compare hub, feature hub, competitor pages, help guides.
- Content-driven SEO pages: `lib/marketing/seoContent/` (features, audience pages, comparisons, help articles).
- Sitemap: `app/sitemap.ts` + `getAllPublicSeoPaths()` in `lib/marketing/seoContent/index.ts`.
- Robots: `app/robots.ts` — allows `/`, disallows `/api/`, `/admin/`, `/tenant/`, `/customer/`.

## Canonical & www

- All public pages set `alternates.canonical` to apex paths (`https://cleanscheduler.com/...`, never `www`).
- `proxy.ts` and `vercel.json` 308-redirect `www.cleanscheduler.com` → `https://cleanscheduler.com/:path*`.
- `proxy.ts` also 308-redirects browser-visible `/marketing/*` HTML paths → the canonical public path (e.g. `/marketing/help/...` → `/help/...`). The `/marketing` App Router tree is an internal rewrite target only; static assets under `public/marketing/` keep their `/marketing/*.png` URLs.
- After deploy, verify: `curl -sI https://www.cleanscheduler.com/` returns `308` to apex, and `curl -sI https://cleanscheduler.com/marketing/help/cleaning-businesses/price-a-cleaning-job` returns `308` to `/help/cleaning-businesses/price-a-cleaning-job`.

### GSC: “Alternate page with proper canonical tag”

This is usually **not a bug**. Google found a duplicate URL (commonly `www.…` or a legacy `/marketing/…` path) whose canonical points at the apex public URL, and correctly chose not to index the duplicate.

- **Expected for www:** Inspect the apex URL (`https://cleanscheduler.com/...`) — that should be Indexed. The www URL may appear under this status or “Page with redirect”; both are fine once www 308s to apex.
- **Action only if** Google-selected canonical differs from the apex path in the sitemap, or an important page is listed here instead of Indexed.

## Indexing policy

**Indexed (sitemap + canonical):**

- Homepage, pricing, start-trial, contact, compare hub, **features hub**
- Feature pages (`/features/*`), audience pages (`/for/*`)
- Competitor comparisons (`/compare/*`) — Jobber, ZenMaid, Launch27, Housecall Pro, Swept, plus category compares
- Owner help hub + articles (`/help/cleaning-businesses/*`)
- Legal/security pages, `/help/faq`, `/why-cleanscheduler`

**Noindex (not in sitemap):**

- Auth flows: `/sign-in`, `/sign-in/mfa`, `/forgot-password`, `/reset-password`, `/complete-employee-invite`, `/access-denied`
- Customer help hub + articles (`/help/customers/*`) — product docs for portal users, not acquisition content

## JSON-LD by page type

| Page                          | Builder                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Homepage                      | `buildHomePageJsonLd` — Organization, WebSite, SoftwareApplication, FAQPage      |
| Pricing                       | `buildPricingPageJsonLd` — tiered SoftwareApplication offers                     |
| Compare hub                   | `buildCompareHubJsonLd` — ItemList of comparison pages                           |
| Features hub                  | `buildFeatureHubJsonLd` — ItemList of feature pages                              |
| Compare / feature / for pages | `buildSeoPageJsonLd` — WebPage, Article, competitor SoftwareApplication entities |
| Help guides                   | `buildHelpGuideJsonLd` — Article graph with breadcrumbs                          |

Shared Organization / software nodes (`lib/marketing/seoJsonLd.ts`) include:

- **Organization** — logo (`ImageObject`), Casper WY mailing address, support + privacy contact points, description
- **WebSite** — publisher/about links to Organization, `inLanguage`
- **SoftwareApplication** + **WebApplication** — description, image, publisher/author, InStock subscription offers

Do **not** add `aggregateRating` until real public reviews exist and are shown on-page (Google spam policy). `FAQPage` markup remains for content understanding; Google retired FAQ rich results in mid-2026, so the Rich Results Test will not list FAQ.

Tests: `lib/marketing/seoJsonLd.test.ts`.

## GSC query mapping (June 2026 — 28-day window)

Baseline: ~178 impressions, 2 clicks, most queries on pages 7–10. Re-measure after 6–8 weeks.

| Query cluster                           | Primary URL                                                                      | Notes                                                      |
| --------------------------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Stripe integration                      | `/features/stripe-integration`                                                   | Best position (~48); exact meta match                      |
| Cleaning scheduling software (variants) | `/features/scheduling-and-dispatch`                                              | Retitled meta + FAQ for staff/company variants             |
| House / residential scheduling          | `/for/residential-cleaning-companies`                                            | Retitled to “house cleaning scheduling software”           |
| Commercial / janitorial scheduling      | `/for/commercial-cleaning-companies`                                             | Existing page; internal links strengthened                 |
| Janitorial scheduling + timekeeping     | `/features/crew-scheduling-and-timekeeping`                                      | **New** — visit check-in + payroll export                  |
| Online payments                         | `/features/invoicing-and-payments`                                               | Retitled meta for “online payments for cleaning companies” |
| Spreadsheet replacement                 | `/compare/spreadsheets-and-texts`                                                | Retitled meta with “replace” keyword                       |
| Employee / crew scheduling              | `/features/crew-scheduling-and-timekeeping`, `/help/.../schedule-cleaning-crews` | **New** pages                                              |
| Dispatch software                       | `/help/.../dispatch-vs-scheduling-for-cleaners`                                  | **New** — scheduling-first positioning                     |
| Mobile / app                            | `/features/mobile-scheduling-for-cleaners`                                       | **New**                                                    |
| How to get commercial accounts          | `/help/.../how-to-get-commercial-cleaning-accounts`                              | Footer + hub links added                                   |

**Ignore:** WinPure pricing, “scheduled database cleanup”, competitor-only pricing queries with no product fit.

## Post-deploy checklist

Use the **admin SEO checklist** at `admin.<apex>/seo` for checkable tasks with persistence and recurring reminders. The list below is the source of truth for task content; the admin UI mirrors these steps.

1. Rich Results Test on homepage, pricing, one compare page, one feature page, one help guide.
2. Google Search Console → URL Inspection → request indexing for:
   - `/features` (hub)
   - `/features/stripe-integration`
   - `/features/scheduling-and-dispatch`
   - `/features/crew-scheduling-and-timekeeping`
   - `/features/mobile-scheduling-for-cleaners`
   - `/features/invoicing-and-payments`
   - `/for/commercial-cleaning-companies`
   - `/for/residential-cleaning-companies`
   - `/compare/spreadsheets-and-texts`
   - `/help/cleaning-businesses/how-to-get-commercial-cleaning-accounts`
   - `/help/cleaning-businesses/schedule-cleaning-crews`
   - `/help/cleaning-businesses/dispatch-vs-scheduling-for-cleaners`
3. Confirm www redirect, `/marketing/*` HTML collapse, and canonical tags in live HTML.
4. Monitor target queries over 6–8 weeks.

See `docs/product/platform-seo-tasks.md` for the admin checklist implementation.

## Adding new SEO pages

1. Add content in `lib/marketing/seoContent/` (follow existing `SeoMarketingPage` or `HelpGuideArticle` shapes).
2. Register in `marketingPages.ts` or `helpArticles.ts` so `getAllPublicSeoPaths()` includes the path.
3. Use `buildPageMetadata()` or `buildMarketingPageMetadata()` for metadata.
4. Wire JSON-LD via `SeoMarketingPage` or `HelpGuideArticle` components.
5. Add cross-links in `relatedLinks` on sibling pages.
6. Extend `seoJsonLd.test.ts` if schema shape changes.
