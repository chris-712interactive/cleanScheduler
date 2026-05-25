# Plaid attestation evidence map

**Last updated:** May 24, 2026  
Use this checklist when completing attestations in the Plaid Security Portal.

---

## 1. Vulnerability scanning — Due 11/22/2026

**Attest:** Yes (after first green CI run)

| Evidence | Location |
|----------|----------|
| Dependabot weekly updates | [`.github/dependabot.yml`](../.github/dependabot.yml) |
| CI `npm audit` (prod deps, high+) | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) |
| PR dependency review | same |
| Documented program | ISP §6 — [`/security/information-security-policy`](/security/information-security-policy) |

**Manual:** Enable Dependabot alerts in GitHub repo settings.

---

## 2. Zero trust access architecture — Due 11/22/2026

**Attest:** Yes (SaaS zero-trust principles, not enterprise ZTNA appliance)

| Evidence | Location |
|----------|----------|
| Zero trust posture document | [`docs/security/zero-trust-posture.md`](./zero-trust-posture.md) |
| Webhook/cron/API verification | [`lib/plaid/verifyPlaidWebhook.ts`](../lib/plaid/verifyPlaidWebhook.ts), cron routes |
| MFA + portal guards | [`lib/auth/requireMfa.ts`](../lib/auth/requireMfa.ts), [`middleware.ts`](../middleware.ts) |
| Workforce MFA runbook | [`docs/security/workforce-access-runbook.md`](./workforce-access-runbook.md) |

**Manual:** Confirm MFA on GitHub, Vercel, Supabase, Stripe, Plaid dashboards.

---

## 3. Secure tokens and certificates — Due 11/22/2026

**Attest:** Yes

| Evidence | Location |
|----------|----------|
| HTTPS / TLS | [`app/marketing/security/page.tsx`](../app/marketing/security/page.tsx) |
| Supabase JWT sessions | [`middleware.ts`](../middleware.ts), [`lib/auth/session.ts`](../lib/auth/session.ts) |
| MFA (TOTP) | [`components/auth/MfaSettingsPanel.tsx`](../components/auth/MfaSettingsPanel.tsx) |
| Stripe webhook HMAC | [`lib/stripe/constructWebhookEvent.ts`](../lib/stripe/constructWebhookEvent.ts) |
| Plaid webhook JWT verify | [`lib/plaid/verifyPlaidWebhook.ts`](../lib/plaid/verifyPlaidWebhook.ts) |
| Token column RLS hardening | [`supabase/migrations/0051_bank_links_token_rls.sql`](../supabase/migrations/0051_bank_links_token_rls.sql) |
| Hashed API keys | [`lib/integrations/authenticateTenantApiRequest.ts`](../lib/integrations/authenticateTenantApiRequest.ts) |

**Manual:** Register Plaid webhook URL in Plaid Dashboard; set `PLAID_WEBHOOK_URL` in production.

---

## 4. Information Security Policy (ISP) — Due 11/22/2026

**Attest:** Yes

| Evidence | Location |
|----------|----------|
| Formal ISP (public) | [`/security/information-security-policy`](/security/information-security-policy) |
| Canonical markdown | [`docs/security/information-security-policy.md`](./information-security-policy.md) |
| Structured content | [`lib/legal/informationSecurityPolicy.ts`](../lib/legal/informationSecurityPolicy.ts) |

**Manual:** Assign policy owner name; export PDF if Plaid requires upload.

---

## 5. Automated de-provisioning / access modification — Due 11/22/2026

**Attest:** Yes (in-app + workforce runbook)

| Evidence | Location |
|----------|----------|
| Deactivate + global sign-out | [`app/tenant/employees/employeeMemberActions.ts`](../app/tenant/employees/employeeMemberActions.ts) |
| `is_active` portal enforcement | [`lib/auth/tenantAccess.ts`](../lib/auth/tenantAccess.ts) |
| Audit trail | [`lib/audit/recordPlatformAuditEvent.ts`](../lib/audit/recordPlatformAuditEvent.ts) |
| Re-invite reactivation | [`app/marketing/complete-employee-invite/actions.ts`](../app/marketing/complete-employee-invite/actions.ts) |
| Workforce offboarding runbook | [`docs/security/workforce-access-runbook.md`](./workforce-access-runbook.md) |

**Manual:** Execute workforce offboarding checklist for company personnel.

---

## 6. Centralized IAM — Due 11/22/2026

**Attest:** Yes

| Evidence | Location |
|----------|----------|
| IAM architecture | [`docs/security/iam-architecture.md`](./iam-architecture.md) |
| Claim sync | [`lib/auth/syncUserAuthClaims.ts`](../lib/auth/syncUserAuthClaims.ts) |
| API key lifecycle audit | [`app/tenant/settings/integrations/actions.ts`](../app/tenant/settings/integrations/actions.ts) |
| Masquerade TTL (60 min) | [`lib/admin/expireStaleMasquerade.ts`](../lib/admin/expireStaleMasquerade.ts) |

**Manual:** Document workforce IdP (Google Workspace) in access review runbook.

---

## 7. MFA where Plaid Link is deployed — Due 11/22/2026

**Attest:** Yes

Plaid Link: tenant portal `/billing/bank-connection` (owner/admin only).

| Evidence | Location |
|----------|----------|
| TOTP enrollment UI | [`app/tenant/settings/account/page.tsx`](../app/tenant/settings/account/page.tsx) |
| Sign-in MFA challenge | [`app/marketing/sign-in/mfa/page.tsx`](../app/marketing/sign-in/mfa/page.tsx) |
| Plaid action enforcement | [`app/tenant/billing/bank-connection/actions.ts`](../app/tenant/billing/bank-connection/actions.ts) |
| Link token API gate | [`app/api/tenant/plaid/link-token/route.ts`](../app/api/tenant/plaid/link-token/route.ts) |

**Manual:** Supabase Dashboard → Authentication → MFA → enable TOTP. Enroll test owner account.

---

## 8. EOL software monitoring — Due 11/22/2026

**Attest:** Yes

| Evidence | Location |
|----------|----------|
| Dependabot | [`.github/dependabot.yml`](../.github/dependabot.yml) |
| Node 22 LTS + engine strict | [`.nvmrc`](../.nvmrc), [`.npmrc`](../.npmrc), [`package.json`](../package.json) |
| EOL policy | [`docs/ops/runtime-eol-policy.md`](../ops/runtime-eol-policy.md) |
| ISP §7 cross-reference | ISP public page |

**Manual:** Set Vercel Node 22.x; calendar quarterly EOL review.

---

## 9. Documented access control policy — Due 11/22/2026

**Attest:** Yes

| Evidence | Location |
|----------|----------|
| Access Control Policy (public) | [`/security/access-control-policy`](/security/access-control-policy) |
| Role matrices | [`lib/legal/accessControlPolicy.ts`](../lib/legal/accessControlPolicy.ts) |
| Quarterly access review runbook | [`docs/security/access-review-runbook.md`](./access-review-runbook.md) |

**Manual:** Complete first quarterly access review; record date in runbook log.

---

## Post-implementation verification

1. [ ] CI green on `main` (including `npm audit`)
2. [ ] Apply migration `0051_bank_links_token_rls.sql` to production Supabase
3. [ ] Enable Supabase TOTP MFA
4. [ ] Enroll MFA on owner/admin; test Plaid sandbox connect
5. [ ] Deactivate test employee; confirm portal block
6. [ ] POST to `/api/webhooks/plaid` without JWT → 400
7. [ ] Complete workforce access review per runbook
8. [ ] Attest all nine items in Plaid dashboard
