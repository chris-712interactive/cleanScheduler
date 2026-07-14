# Runtime and dependency end-of-life (EOL) policy

**Owner:** Platform engineering  
**Review cadence:** Quarterly (January, April, July, October)  
**Last updated:** July 14, 2026

## Scope

This policy covers runtimes and dependencies used to build, deploy, and operate cleanScheduler:

- Node.js (application runtime on Vercel and CI)
- Next.js and React (application framework)
- npm production and development dependencies
- GitHub Actions runner images and action versions
- Supabase Postgres version (managed cloud)
- Third-party SDKs with security implications (Stripe, Plaid, sent.dm, Supabase client)

## Supported versions

| Component  | Supported version          | Source of truth                      |
| ---------- | -------------------------- | ------------------------------------ |
| Node.js    | 22.x LTS (`>=22.22.1`)     | `.nvmrc`, `package.json` engines, CI |
| Next.js    | 16.x (latest stable patch) | `package-lock.json`                  |
| React      | 19.x                       | `package-lock.json`                  |
| TypeScript | 6.x (hold TS 7 until eslint API) | `package-lock.json`            |

Production deployments must not run on Node releases past their LTS maintenance end date.

## Monitoring

1. **Dependabot** (`.github/dependabot.yml`) opens weekly PRs for npm and GitHub Actions updates.
2. **CI vulnerability scanning** runs `npm audit --omit=dev --audit-level=high` on every push and pull request (`.github/workflows/ci.yml`).
3. **Dependency review** blocks pull requests that introduce new dependencies with known high-severity vulnerabilities.
4. **Engine enforcement** — `npm run check:engines` and `.npmrc` `engine-strict=true` reject unsupported Node versions locally and in CI.

## Upgrade SLAs

| Severity / trigger                            | Target response                                        |
| --------------------------------------------- | ------------------------------------------------------ |
| High or critical CVE in production dependency | Patch within 7 calendar days                           |
| Node.js LTS enters maintenance-only or EOL    | Upgrade within 30 calendar days                        |
| Major framework release (Next.js)             | Evaluate within 60 days; upgrade before next LTS cycle |
| Quarterly EOL review                          | Complete review and document outcomes in this file     |

## Quarterly review procedure

1. Check [Node.js release schedule](https://nodejs.org/en/about/previous-releases) and confirm CI/Vercel match `.nvmrc`.
2. Review open Dependabot PRs and merge or defer with documented reason.
3. Run `npm audit` locally and confirm CI is green.
4. Confirm Supabase project Postgres version in dashboard; note any provider EOL notices.
5. Update the **Review log** below.

## Review log

| Date       | Reviewer       | Outcome                                            |
| ---------- | -------------- | -------------------------------------------------- |
| 2026-05-24 | Initial policy | Node 22 LTS adopted; Dependabot + CI audit enabled |

## Exceptions

Document any deferred upgrades (e.g. blocked by upstream breaking change) in a GitHub issue with owner, risk acceptance, and target resolution date.
