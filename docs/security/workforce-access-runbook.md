# Workforce Access Runbook

**Last updated:** May 24, 2026  
**Audience:** Platform engineering / operations

Procedures for granting, modifying, and revoking access for **cleanScheduler company personnel** (founders, contractors, employees) to production systems.

## Systems inventory

| System                      | Access type                                   | MFA required |
| --------------------------- | --------------------------------------------- | ------------ |
| GitHub (source repo)        | Individual account, branch protection on main | Yes          |
| Vercel (hosting)            | Team member, env var access                   | Yes          |
| Supabase (prod DB/auth)     | Dashboard + service role key in Vercel        | Yes          |
| Stripe (platform + Connect) | Dashboard                                     | Yes          |
| Plaid                       | Dashboard + API keys in Vercel                | Yes          |
| Google Workspace (email)    | Company email / IdP                           | Yes          |

## Onboarding checklist

1. Create individual accounts (no shared credentials).
2. Grant minimum role required (e.g. Vercel Developer vs Owner).
3. Enforce MFA before granting production access.
4. Document access in access review log (see access-review-runbook.md).

## Offboarding checklist (within 24 hours)

1. Remove from GitHub organization.
2. Remove from Vercel team.
3. Remove from Supabase organization / rotate service role if exposed.
4. Remove from Stripe and Plaid dashboards.
5. Revoke Google Workspace account or disable sign-in.
6. Review audit log for recent masquerade sessions by departed user.
7. Record completion date in access review log.

## Role transfer

1. Update system roles before removing old access.
2. Transfer ownership of any personal API tokens or integrations.
3. Rotate shared secrets if the departing user had access to Vercel env vars.

## Solo founder note

When a single founder holds all production access, deprovisioning is documented as: disable compromised accounts immediately, rotate all secrets, and maintain MFA on all dashboards.
