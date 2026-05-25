# Access Review Runbook

**Last updated:** May 24, 2026  
**Cadence:** Quarterly (January, April, July, October)

## Scope

Review access for:

- Platform admin accounts (`super_admin`, `admin` in Supabase Auth)
- Open masquerade sessions (`masquerade_sessions` where `ended_at` is null)
- GitHub, Vercel, Supabase, Stripe, Plaid dashboard membership
- Production environment variables and service role key custody
- Tenant API keys (sample high-value tenants if needed)

## Procedure

1. Open founder admin audit log: `admin.<domain>/audit`
2. Export or note last 90 days of `masquerade.start` / `masquerade.end` events
3. List all Supabase users with `app_role` in (`super_admin`, `admin`)
4. Verify each platform admin still requires access; remove stale accounts
5. Confirm all infrastructure dashboard users have MFA enabled
6. Check for masquerade sessions older than 60 minutes still open (should auto-expire)
7. Document review date, reviewer, and findings below

## Review log

| Date | Reviewer | Findings | Actions taken |
|------|----------|----------|---------------|
| 2026-05-24 | Initial setup | First review pending post-implementation | — |

## Escalation

Revoke access immediately and notify legal@712int.com if unauthorized admin account or suspicious masquerade activity is found.
