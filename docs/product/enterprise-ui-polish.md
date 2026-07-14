# Enterprise UI polish

**Last updated:** 2026-07-14  
**Branch:** `dev`

Work to make Clean Scheduler feel less early-stage / “vibe coded” and more like consistent vertical SaaS.

## Shipped

### Design tokens

- Added missing semantic aliases in `styles/_theme.scss`: `--color-surface-muted`, `--color-border-subtle`, `--color-danger-600` (light + dark).

### Shared UI primitives

- `Input`, `Textarea`, `Select`, `FormField`, `Alert`, and Radix-backed `Toast` / `ToastProvider` in `components/ui/`.
- Root layout wraps the app in `ToastProvider`.
- Sign-in, forgot-password, and trial onboarding use the shared form/alert/button primitives.

### Product consistency

- Quotes empty states and Pro report placeholders use `EmptyState`.
- Admin dashboard CTA points to the SEO checklist (removed dead “status page” button).
- Global 404 uses an SCSS module instead of inline styles.

### Onboarding tone

- Checklist / dashboard markers use lucide icons.
- Completion card is calmer (`Setup complete` + `CheckCircle2` + shared `Button`).
- Slug availability burst uses a restrained teal palette (reduced motion still respected).

### Marketing

- Mobile navigation drawer on marketing header.
- Trust strip with links to trial, payments, security, and help (no invented testimonials).
- Campaigns / SMS showcase images no longer reuse the billing hub screenshot with mismatched alts.
- Calmer linear hero backgrounds on marketing landing, pricing, SEO pages, and final CTA.
- Screenshot capture script documents `/campaigns` → `feature-campaigns.png` for future refreshes.

### Typography

- Source Sans 3 via `next/font` as `--font-source-sans`, consumed by `--font-sans` in the theme token stack.
