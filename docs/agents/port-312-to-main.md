# Port #312 onto main

Learned while cherry-picking squash `fac1695b5ac5c4fa1ec1b1717f9e44b9527a7599` (PR #312 on `dev`) onto `origin/main` `67970e8d0990d1f64e956ace909e5286ef90ca89`.

Two conflicts.

`docs/product/implementation-status-summary.md`: main already has a portal-host paragraph between **Branch** and **Latest polish** (`admin.evil.<apex>` and `admin.<apex>.evil.com` are not the admin portal). #312 prepends one sentence to **Latest polish**: changing one office visit's time, deleting a visit that is not part of a series, and moving one series occurrence each send one customer email. The resolution keeps main's portal-host paragraph and prepends that sentence. The other three docs in the squash match `fac1695` exactly.

`tests/local-stack/authenticated.spec.ts`: main already scoped the customer property request form with `#main` and `hasText: 'Location name'`. The squash, from the unscoped form on `dev`, fills `#main form` filtered to `visible: true`. The resolved file is the squash blob. Every other non-doc file matches `fac1695` byte for byte, and those patches match the squash patches.

No migration files are in this squash. Nothing was applied to shared dev or production. Do not change Supabase, Vercel env vars, workflows, `HOSTED_DEV_ISOLATED`, the cookie domain, or `platformAdminFixtureBlock`. Do not send real email, SMS, or payments. `OUTBOUND_SUPPRESSED` still blocks the Resend client; do not set `OUTBOUND_SUPPRESSED=1` while running `next build`, because `lib/outbound/suppression.ts` refuses that flag when `NODE_ENV=production`.

`npm run format`, `npm run lint`, `npm run lint:styles`, `npm run typecheck`, migration checks, and `npm test` passed (204 files, 1129 tests). `npm audit --omit=dev --audit-level=high` found 0 vulnerabilities. `npm run build` passed with a gitignored `.env.local` of public placeholders (`NEXT_PUBLIC_APP_ENV=local`, `lvh.me:3000`, a local Supabase URL and anon key, and a dummy service-role key). That file was not committed. This environment has no Docker, so the local-stack job was left to GitHub.
