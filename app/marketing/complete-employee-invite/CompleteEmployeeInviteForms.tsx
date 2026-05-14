'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import { Button } from '@/components/ui/Button';
import {
  acceptEmployeeInviteAction,
  linkExistingEmployeeInviteAction,
  type CompleteEmployeeInviteState,
} from './actions';
import styles from './complete-employee-invite.module.scss';

const initial: CompleteEmployeeInviteState = {};

export function CompleteEmployeeInviteForms({
  token,
  tenantName,
  inviteEmail,
  hasSession,
  marketingSignInUrl,
}: {
  token: string;
  tenantName: string;
  inviteEmail: string;
  hasSession: boolean;
  marketingSignInUrl: string;
}) {
  const [pwState, pwAction, pwPending] = useActionState(acceptEmployeeInviteAction, initial);
  const [linkState, linkAction, linkPending] = useActionState(linkExistingEmployeeInviteAction, initial);

  return (
    <Stack gap={6} as="div">
      <Card
        title="Create your password"
        description={`You will sign in as ${inviteEmail} for ${tenantName}.`}
      >
        <form action={pwAction} className={styles.form}>
          <input type="hidden" name="token" value={token} />
          {pwState.error ? (
            <p className={styles.error} role="alert">
              {pwState.error}
            </p>
          ) : null}
          {pwState.duplicateAccount ? (
            <p className={styles.hint}>
              Use <strong>Link my account</strong> below if you already have this password on cleanScheduler, or open{' '}
              <Link href={marketingSignInUrl}>sign in</Link> and return here.
            </p>
          ) : null}
          <label className={styles.label} htmlFor="emp-password">
            Password
          </label>
          <input
            id="emp-password"
            name="password"
            type="password"
            autoComplete="new-password"
            className={styles.input}
            required
            minLength={8}
          />

          <label className={styles.label} htmlFor="emp-confirm">
            Confirm password
          </label>
          <input
            id="emp-confirm"
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            className={styles.input}
            required
            minLength={8}
          />

          <Button type="submit" variant="primary" disabled={pwPending}>
            {pwPending ? 'Creating…' : 'Create account & open workspace'}
          </Button>
        </form>
      </Card>

      <Card
        title="Already have a cleanScheduler login?"
        description="Use the same email this invite was sent to. Stay on this page in the same browser."
      >
        {hasSession ? (
          <form action={linkAction} className={styles.form}>
            <input type="hidden" name="token" value={token} />
            {linkState.error ? (
              <p className={styles.error} role="alert">
                {linkState.error}
              </p>
            ) : null}
            <Button type="submit" variant="secondary" disabled={linkPending}>
              {linkPending ? 'Linking…' : 'Link my account to this workspace'}
            </Button>
          </form>
        ) : (
          <p className={styles.hint}>
            Open <Link href={marketingSignInUrl}>sign in</Link>, complete login, then come back here and use Link my
            account.
          </p>
        )}
      </Card>
    </Stack>
  );
}
