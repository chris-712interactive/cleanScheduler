# Outbound suppression

`OUTBOUND_SUPPRESSED=1` is a server-only switch for hosted dev. While it is on, Clean Scheduler does not call Resend, sent.dm, Stripe, Plaid, or customer webhook URLs. Calls that would move money, open a Stripe account, link a bank, or record a message as sent stop before that write and tell the office nothing was sent. Other reads return a local id that starts with `suppressed_` and do not open a socket. The server logs one line:

```text
[outbound] suppressed provider=stripe operation=refunds.create
```

That line has no recipient, URL, token, or message body. A suppressed refund, Connect start, bank link, webhook delivery, SMS, campaign, or outreach send does not change balances, account ids, cursors, quotas, or “sent” status. Webhook rows stay pending and retry after the switch is off. Password reset and sales invites do not call Supabase Auth email.

Customers cannot read or toggle the switch. It is not `NEXT_PUBLIC_`, and nothing in the request (cookie, header, query, or `user_metadata`) is consulted. `GET /api/health/deployment` adds a boolean `outboundSuppressed` and no other new value.

## Enable it

Set this on the Vercel project, for the **dev** environment (the one that serves `dev.cleanscheduler.com`). Add it to **Preview** as well if you exercise `*.vercel.app` previews. Leave **Production** unset.

| Name                  | Value |
| --------------------- | ----- |
| `OUTBOUND_SUPPRESSED` | `1`   |

Any other value, including `true`, leaves the providers live. Do not set the variable in this repository, in GitHub Actions, or on the production Vercel environment. After you save it, redeploy dev so the new process env is picked up. Confirm with:

```bash
curl -sS https://dev.cleanscheduler.com/api/health/deployment
```

`outboundSuppressed` is `true` only on that deployment. The isolated runner still keeps mutations, payments, refunds, bank links, sends, and cron **blocked** until that field is true. `HOSTED_DEV_MUTATIONS=1` on the runner is not enough.

## Production

The process throws, including from `instrumentation.ts` at startup, when the flag is `1` and any of these is true:

- `VERCEL_ENV` is `production` in any letter case, or
- `NEXT_PUBLIC_APP_DOMAIN` is `cleanscheduler.com`, `www.cleanscheduler.com`, or another `*.cleanscheduler.com` host that is not `dev.cleanscheduler.com` or `*.dev.cleanscheduler.com`, or
- `NODE_ENV` is `production` and `VERCEL_ENV` is not `preview` or `development`.

Vercel sets `NODE_ENV=production` on preview deploys. Those stay allowed when `VERCEL_ENV` is `preview`. A local `next start` with no Vercel environment does not.

Hosted dev (`dev.cleanscheduler.com`) can enable it. A request `Host` header cannot.

Inbound Stripe webhook verification fails closed while the switch is on, so a captured signature cannot be turned into a local “paid” event. Plaid webhook key lookup does not call Plaid. Refreshing a Stripe Connect account does not overwrite the stored charges flag with the fake account.

## What is not suppressed

These still make network calls when their own keys are set:

- Google Geocoding and the US Census geocoder
- Mapricot driving miles
- Vercel domain API
- Supabase (database, Auth, and the Management API)
- Cloudflare Turnstile siteverify
- A published outreach CSV fetch

Browser Plaid Link and any Stripe.js load run in the customer’s browser. The server will not exchange a public token or create a charge while the switch is on. Opening Plaid Link with a `suppressed_` link token does not link a bank.

Cron routes still require `CRON_SECRET`. When they run, their email, SMS, Stripe, Plaid, and webhook calls use the same short-circuit.

## Hosted-dev mutations

With `HOSTED_DEV_MUTATIONS=1` and `outboundSuppressed: true`, the isolated suite adds a customer on the residential QA tenant (first name only, no email, no address) and checks the browser did not call Stripe, Plaid, Resend, or sent.dm. It does not click Connect, refund, bank link, or cron. Those would store a fake provider id on the QA tenant or need a cron secret that this workflow does not inject.

## Notes for later sessions

- Construct providers only in `lib/stripe/server.ts`, `lib/email/resendClient.ts`, `lib/plaid/server.ts`, and `lib/sms/sentDmServer.ts`. `lib/outbound/providerClientGuard.test.ts` fails the build when `new Stripe`, `new Resend`, `new PlaidApi`, or `new SentDm` shows up anywhere else.
- `isResendConfigured`, `isSentDmConfigured`, and `isPlaidConfigured` return true while the switch is on, so send and link flows continue without live keys. They still throw if production is asked to suppress.
- Do not treat a fake subscription retrieve as a billing update. `syncTenantPlatformBillingFromStripe` returns before it writes.
- Do not set `HOSTED_DEV_ISOLATED`, GitHub environments, or this flag from an agent. The user turns the Vercel variable on.
