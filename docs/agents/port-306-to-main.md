# Port #306 onto main

Learned while cherry-picking squash `a6e529f8526e6387f888525b42fcbca97d5db211` (PR #306 on `dev`) onto `origin/main` `bf90cca38d3cda26d11d933d14a1d59c4a155cb0`.

One conflict, in `docs/product/implementation-status-summary.md`. Main already has a portal-host paragraph between **Branch** and **Latest polish** (`admin.evil.<apex>` and `admin.<apex>.evil.com` are not the admin portal). #306 prepends one sentence to **Latest polish**: a customer gets one email when a repeating visit series is created, changed, or cancelled, generated occurrences stay silent, and a time-off decision emails the person who asked. The rest of that paragraph matched. The resolution keeps main's portal-host paragraph and prepends that sentence. Every other file in the squash applied unchanged.

No migration files are in this squash. Nothing was applied to shared dev or production. Do not change Supabase, Vercel env vars, workflows, `HOSTED_DEV_ISOLATED`, the cookie domain, or `platformAdminFixtureBlock`. Do not send real email, SMS, or payments. `OUTBOUND_SUPPRESSED` still blocks the Resend client; do not set `OUTBOUND_SUPPRESSED=1` while running `next build`, because `lib/outbound/suppression.ts` refuses that flag when `NODE_ENV=production`.

`npm run format:check`, `npm run lint`, `npm run lint:styles`, `npm run typecheck`, and `npm test` passed (198 files, 1071 tests). `npm run build` passed with a gitignored `.env.local` of public placeholders (`NEXT_PUBLIC_APP_ENV=local`, `lvh.me:3000`, a local Supabase URL and anon key, and a dummy service-role key). That file was not committed.
