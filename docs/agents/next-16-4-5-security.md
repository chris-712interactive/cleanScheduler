# Next.js 16.4.5 security bump

Learned while patching the November 2026 Next.js advisories on the 16.4 line.

The lockfile resolved `next` and `eslint-config-next` at **16.4.1** even though `package.json` used `^16.4.1`. `npm audit` and `POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk` with `{"next":["16.4.1"]}` returned only **GHSA-mfr8-8qww-v76h** (npm advisory id **1247486**, moderate, vulnerable `>=16.3.0 <=16.4.4`). The published GitHub advisories and the [v16.4.5 release notes](https://github.com/vercel/next.js/releases/tag/v16.4.5) list six more issues in the same range. Do not treat the npm bulk response as the full set when the Next.js security release notes name additional GHSA ids.

The smallest same-major fix is **16.4.5**. **16.4.6** backports non-security bug fixes and is not required to clear these advisories. Keep `eslint-config-next` and every `@next/*` package (`@next/env`, `@next/eslint-plugin-next`, `@next/swc-*`) on that same version.

No application source changed. `unstable_cache` call sites were left as they are. Auth cookie domain scoping, `platformAdminFixtureBlock`, RLS, and secret redaction were not part of this bump.

`npm run build` on a clean agent checkout fails while collecting `/_not-found` if `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_DOMAIN`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset. `app/layout.tsx` reads them through `getPublicOrigin` for `metadataBase`. On `main`, prerender of `/marketing` also calls `getServerEnv()`, which requires `SUPABASE_SERVICE_ROLE_KEY` (the placeholder in `.env.example` is enough). A verbatim copy of `.env.example` is still not enough: blank `NEXT_PUBLIC_SENTRY_DSN=` fails `z.string().url().optional()`, and blank `RESEND_FROM_EMAIL=` fails `z.string().min(1).optional()`. Comment out or delete those two lines so they are unset. That is existing env validation, not a 16.4.5 API break. CI (`.github/workflows/ci.yml`) does not run `npm run build`.
