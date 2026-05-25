# Zero Trust Posture

**Last updated:** May 24, 2026

cleanScheduler applies **zero trust principles** to its cloud-native SaaS architecture. We do not operate a corporate ZTNA appliance; instead we verify every request and grant least-privilege access across application, API, and operational layers.

## Principles applied

| Principle | Implementation |
|-----------|----------------|
| Never trust, always verify | Middleware + portal guards on all protected routes; webhook signature verification (Stripe, Plaid); cron Bearer auth |
| Least privilege | Tenant RBAC; Plaid admin-only; API keys scoped to tenant; service role only in server actions after auth checks |
| Assume breach | MFA for privileged users; session invalidation on deactivation; audit logging for masquerade and member changes |
| Explicit verification | No network-based trust; all access over HTTPS; production secrets in Vercel env only |
| Micro-segmentation (logical) | Portal isolation by subdomain; RLS workspace boundaries; customer portal scoped to linked tenants |

## Control mapping

- **Application:** Supabase JWT sessions, MFA (TOTP) for owner/admin, field-employee route allowlist.
- **API:** `/api/*` excluded from middleware auth; each route implements its own verification (cron secret, webhook signatures, API keys).
- **Data:** Postgres RLS + application tenant scoping on service-role queries.
- **Operations:** Workforce MFA on infrastructure dashboards (GitHub, Vercel, Supabase, Stripe, Plaid) per workforce runbook.

## Attestation note

When attesting "zero trust access architecture," we refer to this **verify-every-request SaaS model**, not deployment of enterprise ZTNA products (Zscaler, Okta BeyondCorp, etc.).

See also [Information Security Policy](./information-security-policy.md) §12.
