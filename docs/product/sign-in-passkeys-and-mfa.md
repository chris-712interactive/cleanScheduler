# Passkeys and workspace two-factor authentication

**Last updated:** 2026-10-05

People can sign in with a passkey instead of a password. A workspace owner or admin can turn that off, and can require a second step using an authenticator app, a passkey, or either.

## What a member does

1. Sign in once with a password or Google.
2. Open **Settings → Account** and choose **Add a passkey**. The phone or computer asks for Face ID, a fingerprint, or a PIN.
3. Next time, on the sign-in page, choose **Sign in with a passkey**.

Customers can add a passkey from **Settings** in the customer portal. Platform staff can add one from admin **Settings**.

Removing a passkey does not delete the password. Password and Google sign-in stay available unless the person simply chooses the passkey button.

## What an owner or admin sets

**Settings → Sign-in security**

| Setting                             | Default                       | Effect                                                                                                                      |
| ----------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Allow passkeys instead of passwords | On                            | Members who saved a passkey may use it for this workspace. Off rejects a passkey session and asks for a password or Google. |
| Require two-factor authentication   | Off                           | When on, the workspace stays locked until this session has one accepted second step.                                        |
| Acceptable second steps             | Authenticator app and passkey | At least one is required when two-factor authentication is on. Either accepted method is enough.                            |

A passkey sign-in counts as the second step when passkeys are an accepted method, because the device verified the person. An authenticator app counts after the 6-digit code is entered.

Bank connection for owners and admins still requires an authenticator app. A passkey does not replace that check.

While someone still needs to enroll or verify, they can open **Account** and **Sign-in security**. The rest of the workspace redirects them.

## Supabase setup

Passkeys stay off in the hosted project until Authentication → Passkeys is enabled. Set the relying party to the parent domain (`cleanscheduler.com` in production) and list every origin that serves sign-in, including `https://cleanscheduler.com` and tenant subdomains you use. Changing the relying party id later invalidates existing passkeys.

Local `http://lvh.me` is not a secure context, so the browser will not offer a passkey there. Use `http://localhost` or HTTPS.

The app opts in with `auth.experimental.passkey` on the Supabase clients (`lib/supabase/authOptions.ts`).

## Data

Migration `0096_tenant_auth_policy.sql` adds `allow_passkey_sign_in`, `mfa_required`, and `mfa_allowed_methods` on `tenant_operational_settings`.
