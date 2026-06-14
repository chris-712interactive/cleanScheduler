# Marketing SEO

Developer reference for public-site search optimization on cleanscheduler.com.

## Architecture

- Marketing routes live under `app/marketing/*` and are served at apex paths via `proxy.ts` rewrites (`/pricing` → `/marketing/pricing`).
- `metadataBase` in `app/layout.tsx` uses `getPublicOrigin(null)` → `https://cleanscheduler.com` (non-www apex).
- Shared metadata helper: `lib/marketing/marketingPageMetadata.ts` (`buildMarketingPageMetadata`, `NOINDEX_PAGE_METADATA`, `DEFAULT_OG_IMAGE`).
- Structured data: `lib/marketing/seoJsonLd.ts` — homepage, pricing, compare hub, competitor pages, help guides.
- Content-driven SEO pages: `lib/marketing/seoContent/` (features, audience pages, comparisons, help articles).
- Sitemap: `app/sitemap.ts` + `getAllPublicSeoPaths()` in `lib/marketing/seoContent/index.ts`.
- Robots: `app/robots.ts` — allows `/`, disallows `/api/`, `/admin/`, `/tenant/`, `/customer/`.

## Canonical & www

- All public pages set `alternates.canonical` to apex paths.
- `proxy.ts` and `vercel.json` 308-redirect `www.cleanscheduler.com` → `https://cleanscheduler.com/:path*`.
- After deploy, verify: `curl -sI https://www.cleanscheduler.com/` returns `308` to apex.

## Indexing policy

**Indexed (sitemap + canonical):**

- Homepage, pricing, start-trial, contact, compare hub
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
| Compare / feature / for pages | `buildSeoPageJsonLd` — WebPage, Article, competitor SoftwareApplication entities |
| Help guides                   | `buildHelpGuideJsonLd` — Article graph with breadcrumbs                          |

Tests: `lib/marketing/seoJsonLd.test.ts`.

## GSC target queries (content aligned)

Pages retitled/created to match near-page-one impressions:

- Stripe integration → `/features/stripe-integration`
- Commercial scheduling → `/for/commercial-cleaning-companies`, `/features/scheduling-and-dispatch`
- Cleaning schedule software → `/features/scheduling-and-dispatch`
- How to get commercial cleaning accounts → `/help/cleaning-businesses/how-to-get-commercial-cleaning-accounts`

## Post-deploy checklist

1. Rich Results Test on homepage, pricing, one compare page, one help guide.
2. Google Search Console → URL Inspection → request indexing for new/changed URLs.
3. Confirm www redirect and canonical tags in live HTML.
4. Monitor target queries over 6–8 weeks.

## Adding new SEO pages

1. Add content in `lib/marketing/seoContent/` (follow existing `SeoMarketingPage` or `HelpGuideArticle` shapes).
2. Register in `marketingPages.ts` or `helpArticles.ts` so `getAllPublicSeoPaths()` includes the path.
3. Use `buildPageMetadata()` or `buildMarketingPageMetadata()` for metadata.
4. Wire JSON-LD via `SeoMarketingPage` or `HelpGuideArticle` components.
5. Add cross-links in `relatedLinks` on sibling pages.
6. Extend `seoJsonLd.test.ts` if schema shape changes.
