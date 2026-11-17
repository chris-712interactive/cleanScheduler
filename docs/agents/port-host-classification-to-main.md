# Port host classification and post-login navigation onto main

Learned while comparing `origin/main` `fe259882fc48ea20b8ddb10410f4df3be96e2d9a` with `origin/dev` `b3c7017ba3032ffad60f74f1b570959090f6cb3e`.

Main was already carrying the platform-admin and tenant-isolation work through earlier ports:

- #242 and #243 and #244 via #245 (`d3f9234`)
- #246, #247, and #248 via #250 (`122276b`)
- #249 via #251 (`ed3d4ff`)
- #252 via #253 (`cc84004`)
- The open-redirect half of #236 via #237 (`852373d`)

Those trees match `dev` for `lib/auth/tenantAccess.ts`, `platformAdminDemotion`, `tenantPortalAdmission`, `syncUserAuthClaims`, `signInNextPath`, `masqueradeHandoff`, and `supabase/migrations`. This port does not add a migration. `0124`, `0125`, and `0126` are already on `main`.

What `main` was still missing is the exact-host half of #236 (`5b8c1c5`) and the admin-host stay of #234 (`7d57f77`):

- `platformHostLabel` requires one label directly under the apex. `proxy.ts`, `lib/portal.ts`, `inferPortalFromHost`, `classifySeoHost`, the theme script, and `classifyPostLoginHost` all use it.
- `resolvePostLoginDestination` keeps platform staff who finish on the real admin host on the canonical admin origin, including when they also have a workspace. A nested host is not that origin.
- Password sign-in returns `redirectTo` for a document load when the destination path is `/`, so the proxy rewrite runs instead of a client navigation that reuses the marketing homepage.

Left on `dev` on purpose: hosted-dev QA, outbound suppression, quote idempotency, redaction, Dependabot, and SEO work that is not this host fix. #237 already brought the hosted-dev pieces of #236. Do not widen the auth cookie domain, do not weaken `platformAdminFixtureBlock`, and do not read `user_metadata` for authorization.

`npm run build` still needs `.env.example` with `NEXT_PUBLIC_SENTRY_DSN` and `RESEND_FROM_EMAIL` unset. See `docs/agents/next-16-4-5-security.md`.
