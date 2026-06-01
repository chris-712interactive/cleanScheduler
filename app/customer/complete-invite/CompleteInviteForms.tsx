'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import {
  acceptCustomerPortalInviteAction,
  linkExistingCustomerInviteAction,
  type CompleteInviteState,
} from './actions';
import styles from './complete-invite.module.scss';

const initial: CompleteInviteState = {};

export function CompleteInviteForms({
  token,
  tenantName,
  inviteEmail,
  returnPath,
  hasSession,
  marketingSignInUrl,
}: {
  token: string;
  tenantName: string;
  inviteEmail: string;
  returnPath: string;
  hasSession: boolean;
  marketingSignInUrl: string;
}) {
  const [pwState, pwAction, pwPending] = useActionState(acceptCustomerPortalInviteAction, initial);
  const [linkState, linkAction, linkPending] = useActionState(
    linkExistingCustomerInviteAction,
    initial,
  );

  return (
    <Stack gap={6} as="div">
      <Card
        title="Create your password"
        description={`Finish your profile for ${tenantName}. Your login email is fixed to this invite.`}
      >
        <form action={pwAction} className={styles.form}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="next" value={returnPath} />
          {pwState.error ? (
            <p className={styles.error} role="alert">
              {pwState.error}
            </p>
          ) : null}
          {pwState.duplicateAccount ? (
            <p className={styles.hint}>
              Use <strong>Link my account</strong> below if you are already signed in with{' '}
              {inviteEmail}, or open <Link href={marketingSignInUrl}>sign in</Link> on the main site
              and return here.
            </p>
          ) : null}
          <label className={styles.label} htmlFor="invite_email">
            Email
          </label>
          <input
            id="invite_email"
            name="email"
            type="email"
            className={styles.input}
            value={inviteEmail}
            readOnly
            autoComplete="username email"
          />
          <label className={styles.label} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            className={styles.input}
            required
            minLength={8}
          />

          <label className={styles.label} htmlFor="confirm_password">
            Confirm password
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            className={styles.input}
            required
            minLength={8}
          />

          <label className={styles.label} htmlFor="phone">
            Phone number (optional)
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={styles.input}
            placeholder="(555) 123-4567"
          />

          <label className={styles.checkboxRow} htmlFor="sms_opt_in">
            <input id="sms_opt_in" name="sms_opt_in" type="checkbox" value="on" />
            <span>
              I agree to receive text messages from Clean Scheduler about my bookings and account.
              Message frequency varies based on your bookings. Message and data rates may apply.
              Reply STOP to unsubscribe. Reply HELP for help. View our{' '}
              <Link href="/privacy">Privacy Policy</Link> and{' '}
              <Link href="/sms-terms">Terms &amp; Conditions</Link>.
            </span>
          </label>

          <Button type="submit" variant="primary" disabled={pwPending}>
            {pwPending ? 'Creating…' : 'Create account & continue'}
          </Button>
        </form>
      </Card>

      <Card
        title="Already have a Clean Scheduler login?"
        description="Use the same email this invite was sent to. Stay on this page in the same browser."
      >
        {hasSession ? (
          <form action={linkAction} className={styles.form}>
            <input type="hidden" name="token" value={token} />
            <input type="hidden" name="next" value={returnPath} />
            {linkState.error ? (
              <p className={styles.error} role="alert">
                {linkState.error}
              </p>
            ) : null}
            <Button type="submit" variant="secondary" disabled={linkPending}>
              {linkPending ? 'Linking…' : 'Link my account to this invite'}
            </Button>
          </form>
        ) : (
          <p className={styles.hint}>
            Open <Link href={marketingSignInUrl}>sign in</Link>, complete login, then come back here
            and use Link my account.
          </p>
        )}
      </Card>
    </Stack>
  );
}
