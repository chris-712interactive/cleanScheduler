'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { sendEmployeeInviteAction, type EmployeeInviteFormState } from './employeeInviteActions';
import type { TenantRole } from '@/lib/auth/types';
import styles from './employees.module.scss';

const initial: EmployeeInviteFormState = {};

function roleLabel(r: TenantRole): string {
  if (r === 'admin') return 'Admin — billing, settings, and team management';
  if (r === 'employee') return 'Employee — day-to-day work (quotes, schedule, customers)';
  if (r === 'viewer') return 'Viewer — read-only access';
  return r;
}

export function EmployeeInviteForm({
  tenantSlug,
  allowedRoles,
  emailReady,
}: {
  tenantSlug: string;
  allowedRoles: TenantRole[];
  emailReady: boolean;
}) {
  const [state, action, pending] = useActionState(sendEmployeeInviteAction, initial);

  if (allowedRoles.length === 0) {
    return <p className={styles.muted}>Only workspace owners and admins can send invites.</p>;
  }

  return (
    <div className={styles.inviteBlock}>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className={styles.success}>{state.success}</p> : null}
      <form action={action} className={styles.inviteForm}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <label className={styles.field}>
          <span>Work email</span>
          <input name="email" type="email" className={styles.input} required autoComplete="off" />
        </label>
        <label className={styles.field}>
          <span>Permission level</span>
          <select name="invited_role" className={styles.select} required defaultValue="">
            <option value="" disabled>
              Select…
            </option>
            {allowedRoles.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" variant="primary" disabled={pending || !emailReady}>
          {pending ? 'Sending…' : 'Email invite'}
        </Button>
      </form>
      {!emailReady ? (
        <p className={styles.muted}>
          Set <strong>RESEND_API_KEY</strong> and <strong>RESEND_FROM_EMAIL</strong> on the server. Invites use the
          same sender as quote mail.
        </p>
      ) : (
        <p className={styles.muted}>
          Sends a 7-day link to create a password on the main site, then opens their workspace at{' '}
          <strong>{tenantSlug}</strong>.
        </p>
      )}
    </div>
  );
}
