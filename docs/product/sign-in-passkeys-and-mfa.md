# Passkeys and workspace two-factor authentication

**Last updated:** 2026-10-05

People can sign in with a passkey instead of a password. A workspace owner or admin can turn that off, and can require a second step using an authenticator app, a passkey, or either.

## What a member does

1. Sign in once with a password or Google.
2. Open **Settings → Account** and choose **Add a passkey**. The phone or computer asks for Face ID, a fingerprint, or a PIN.
3. Next time, on the sign-in page, choose **Sign in with a passkey**.

Customers can add a passkey from **Settings** on `my.cleanscheduler.com`. The passkey button is hidden on a white-label custom domain, because that address cannot use a `cleanscheduler.com` passkey. Platform staff can add one from admin **Settings**.

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

## Passkey setup

Passkeys are checked by Clean Scheduler, then a normal Supabase session is opened for that user. They are not Supabase Auth passkeys, so the five-origin dashboard limit does not apply.

The relying party id is the parent domain (`cleanscheduler.com` in production, `localhost` for local http). Every `https://{slug}.cleanscheduler.com` address can use the same passkey. A white-label custom domain cannot, and the passkey buttons stay hidden there.

Apply migration `0097_user_passkeys.sql`. The public key is stored in `user_passkeys`. `user_passkey_sessions` marks the Supabase session that followed a successful check, which is how a passkey counts as a second step.

## Data

Migration `0096_tenant_auth_policy.sql` adds `allow_passkey_sign_in`, `mfa_required`, and `mfa_allowed_methods` on `tenant_operational_settings`. Migration `0097_user_passkeys.sql` stores passkey credentials and the sessions opened after a passkey check.
