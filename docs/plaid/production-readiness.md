# Plaid production readiness

Checklist for launching bank reconciliation with Plaid in **Production**. Aligns with Plaid MSA requirements and internal attestation (`docs/security/plaid-attestation-evidence.md`).

---

## 1. End-user notices and consent

| Item                                                    | Status    | Evidence                                                                                                      |
| ------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| Pre-Link disclosure on bank connection page             | ✅        | `PlaidPreLinkConsent.tsx`, `lib/plaid/plaidConsentCopy.ts`                                                    |
| Checkbox consent before Link opens                      | ✅        | `PlaidLinkButton.tsx` + server enforcement in `actions.ts`                                                    |
| Privacy Policy — Plaid data use                         | ✅        | `app/marketing/privacy/page.tsx`                                                                              |
| Plaid End User Privacy Policy link                      | ✅        | Pre-Link UI + privacy policy                                                                                  |
| Plaid Dashboard — Data Transparency Messaging use case  | ⬜ Manual | Configure under **Link → Customize → Data Transparency** in Plaid Dashboard (required for US Production Link) |
| Plaid Dashboard — Consent pane (co-brand logo optional) | ⬜ Manual | **Link → Customize → Consent**                                                                                |

---

## 2. Secure storage of sensitive Plaid data

| Item                                                           | Status | Evidence                                                                        |
| -------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------- |
| Access tokens server-side only (service role)                  | ✅     | `bank_links.plaid_access_token`; RLS migration `0051_bank_links_token_rls.sql`  |
| Tenant members see `bank_links_member_safe` view (no token)    | ✅     | `0051`, tenant page selects safe columns                                        |
| Tokens never sent to browser / client bundles                  | ✅     | Link token is short-lived; public token exchanged server-side only              |
| Revoke on disconnect, trial expiry, subscription cancel, purge | ✅     | `lib/plaid/revokePlaidBankLink.ts`                                              |
| Revoke previous Item when replacing bank (new Plaid Item)      | ✅     | `exchangeAndSaveBankLink` calls `tryRemovePlaidLinkItem` when `item_id` changes |
| MFA required before Link (owner/admin)                         | ✅     | `requireMfaForBankAdmin`, account settings                                      |
| Webhook JWT verification in production                         | ✅     | `lib/plaid/verifyPlaidWebhook.ts`                                               |

---

## 3. No sandbox API in Production

| Item                                                                                   | Status | Notes                                                 |
| -------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------- |
| SDK uses `PlaidEnvironments.production` when `PLAID_ENV=production`                    | ✅     | `lib/plaid/server.ts` — no hardcoded `/sandbox/` URLs |
| App refuses `PLAID_ENV=sandbox` when `NEXT_PUBLIC_APP_ENV=prod` and `PLAID_SECRET` set | ✅     | `lib/env.ts`                                          |
| UI hides sandbox test-credentials copy in Production                                   | ✅     | `bank-connection/page.tsx` uses `isPlaidSandboxEnv()` |
| No direct HTTP calls to `sandbox.plaid.com`                                            | ✅     | All traffic via official `plaid` Node SDK             |

---

## 4. Production server and API keys

Set in **Vercel → Production** (and verify Preview/Dev use sandbox separately):

```bash
PLAID_CLIENT_ID=<production client id>
PLAID_SECRET=<production secret>
PLAID_ENV=production
PLAID_WEBHOOK_URL=https://cleanscheduler.com/api/webhooks/plaid
PLAID_WEBHOOK_VERIFY=true   # default; do not disable in prod
```

**Plaid Dashboard (Production environment):**

1. Enable **Transactions** product (already used in `linkTokenCreate`).
2. Register webhook URL → `/api/webhooks/plaid`.
3. Complete **Production access request** if not already approved.
4. Configure **Data Transparency Messaging** use case: _transaction history for payment reconciliation_.
5. Request **OAuth institutions** as needed for your target banks.

**Supabase Production:**

- [ ] Migration `0051_bank_links_token_rls.sql` applied.

**Smoke test (Production):**

1. Owner/admin with MFA enrolled → Billing → Bank connection.
2. Read pre-Link notice, check consent, connect real institution.
3. Confirm deposits sync (`Sync` or wait for cron `/api/cron/plaid-sync`).
4. Confirm match suggestion or manual match records invoice payment.
5. Disconnect → verify Plaid item removed and status `disconnected`.

---

## Related docs

- `docs/security/plaid-attestation-evidence.md` — security portal attestations
- `docs/product/implementation-backlog-snapshot.md` — broader roadmap (resume after Plaid)
- Plaid: [Pre-Link messaging](https://plaid.com/docs/link/messaging/), [Data Transparency Messaging](https://plaid.com/docs/link/data-transparency-messaging-migration-guide/)
