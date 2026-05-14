'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { sendCustomerPortalInviteAction, type CustomerInviteFormState } from './inviteActions';
import styles from './customers.module.scss';

const initial: CustomerInviteFormState = {};

export function CustomerPortalInvitePanel({
  tenantSlug,
  customerId,
  customerEmail,
  portalLinked,
  emailReady,
}: {
  tenantSlug: string;
  customerId: string;
  customerEmail: string;
  portalLinked: boolean;
  emailReady: boolean;
}) {
  const [state, action, pending] = useActionState(sendCustomerPortalInviteAction, initial);

  if (portalLinked) {
    return <p className={styles.inviteHint}>This customer already has a portal login linked.</p>;
  }

  if (!customerEmail.trim()) {
    return (
      <p className={styles.inviteHint}>Add an email address on this customer before sending a portal invite.</p>
    );
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
        <input type="hidden" name="customer_id" value={customerId} />
        <Button type="submit" variant="secondary" disabled={pending || !emailReady}>
          {pending ? 'Sending…' : 'Email portal invite'}
        </Button>
      </form>
      {!emailReady ? (
        <p className={styles.inviteHint}>
          Server email is not configured. Set RESEND_API_KEY. Portal invites use your Resend template for from/subject; quote emails still need RESEND_FROM_EMAIL.
        </p>
      ) : (
        <p className={styles.inviteHint}>
          Sends <strong>{customerEmail}</strong> a link (valid 7 days) to finish signup on the customer portal and
          link this record to their login.
        </p>
      )}
    </div>
  );
}
