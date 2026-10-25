# Tenant marketing website

Business and Pro workspaces can publish a **structured CMS marketing site** with SEO metadata, contact-form lead capture, and optional unified custom domain routing (Pro).

## Settings

**Website** (`/settings/website`) — page list, publish toggle, **appearance** (layout template + color scheme), site defaults, leads inbox.

**Website domain** (`/settings/website/domain`, Pro paid) — switch custom domain between `portal_only` and `unified` (`/` = marketing, `/portal` = customer portal).

## Public URLs

| Tier        | Host                        | Example                                 |
| ----------- | --------------------------- | --------------------------------------- |
| Business    | `{slug}.{apex}/site`        | `https://acme.lvh.me:3000/site`         |
| Business    | `{slug}.{apex}/site/{slug}` | `https://acme.lvh.me:3000/site/contact` |
| Pro unified | Custom domain root          | `https://www.acme.com/`                 |
| Pro unified | Custom domain portal        | `https://www.acme.com/portal`           |

## Entitlements

See [tier-entitlements.md](../billing/tier-entitlements.md) — `tenantMarketingSite`, `tenantMarketingSiteCustomDomain`, page limits.

## Indexing

Published, paid sites are indexable. Trial and unpublished sites send `noindex` and a `Disallow: /` robots file.

`/robots.txt` and `/sitemap.xml` skip the portal rewrite, so `app/robots.ts` and `app/sitemap.ts` read the `Host` header:

- **Platform apex** (`cleanscheduler.com`) keeps the product marketing sitemap.
- **Tenant subdomain** (`{slug}.{apex}`) allows `/site` only, and lists canonical page URLs such as `https://{slug}.{apex}/site/services`. The customer portal on that host is disallowed.
- **Unified custom domain** allows `/`, disallows `/portal` and `/api/`, and lists root URLs such as `https://www.acme.com/services`.
- **Any other custom hostname** does not advertise the platform sitemap.

Canonical tags, Open Graph, and JSON-LD use that same public origin. Titles are absolute, so pages are not suffixed with “Clean Scheduler”. Share images are the tenant logo or page image only.

Structured data is `HouseCleaner` (name, NAP, hours, service area, and an offer catalog on home and services pages) plus `WebPage`, `BreadcrumbList`, and `FAQPage` when that content is on the page.

## Out of the box

The first time a workspace opens Website settings, the CMS seeds five draft pages: home, services, about, FAQ, and contact. Copy uses the business name and city when those are already saved, and contact email, phone, and service area are copied from business settings. Pages stay drafts until someone publishes them.

The public renderer is a light, service-business layout (sticky header, service cards, quote form, FAQ, and a dark close) regardless of the visitor’s app theme. Appearance settings still switch Classic, Modern, and Editorial plus the color scheme.

## Schema

Migration `0076_tenant_marketing_site.sql`:

- `tenant_marketing_site_settings` — includes `site_template` and `color_scheme` (migration `0077`)
- `tenant_marketing_pages`
- `tenant_marketing_leads`
- `tenant_customer_portal_domains.site_mode`

## Implementation map

- Public routes: `app/site/*`
- Host-aware robots and sitemap: `app/robots.ts`, `app/sitemap.ts`, `lib/tenantSite/hostSeo.ts`
- CMS: `app/tenant/settings/website/*`
- Rendering: `components/tenantSite/*`
- Loaders: `lib/tenantSite/loadTenantSiteData.ts`
- Proxy: `proxy.ts` (`PortalKind = site`, unified domain routing)
