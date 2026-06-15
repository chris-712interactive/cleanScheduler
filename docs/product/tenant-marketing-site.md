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

- **Trial:** CMS preview allowed; pages use `noindex`.
- **Paid + published:** indexable; per-tenant `sitemap.xml` and `robots.txt` on site hosts.

## Schema

Migration `0076_tenant_marketing_site.sql`:

- `tenant_marketing_site_settings` — includes `site_template` and `color_scheme` (migration `0077`)
- `tenant_marketing_pages`
- `tenant_marketing_leads`
- `tenant_customer_portal_domains.site_mode`

## Implementation map

- Public routes: `app/site/*`
- CMS: `app/tenant/settings/website/*`
- Rendering: `components/tenantSite/*`
- Loaders: `lib/tenantSite/loadTenantSiteData.ts`
- Proxy: `proxy.ts` (`PortalKind = site`, unified domain routing)
