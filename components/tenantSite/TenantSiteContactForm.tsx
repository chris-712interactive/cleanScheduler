'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { submitTenantSiteLeadAction, type TenantSiteLeadActionState } from '@/app/site/actions';
import styles from './TenantSitePage.module.scss';

export function TenantSiteContactForm({
  tenantSlug,
  pageId,
}: {
  tenantSlug: string;
  pageId?: string | null;
}) {
  const [state, formAction, pending] = useActionState<TenantSiteLeadActionState, FormData>(
    submitTenantSiteLeadAction,
    {},
  );

  return (
    <form action={formAction} className={styles.contactForm}>
      <input type="hidden" name="tenant_slug" value={tenantSlug} />
      {pageId ? <input type="hidden" name="page_id" value={pageId} /> : null}
      <div className={styles.honeypot} aria-hidden="true">
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.error ? (
        <p className={styles.formError} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className={styles.formSuccess} role="status">
          Thanks — we received your message and will follow up soon.
        </p>
      ) : null}

      <label className={styles.fieldLabel}>
        Name
        <input className={styles.fieldInput} name="name" required disabled={pending} />
      </label>
      <label className={styles.fieldLabel}>
        Email
        <input
          className={styles.fieldInput}
          type="email"
          name="email"
          required
          disabled={pending}
        />
      </label>
      <label className={styles.fieldLabel}>
        Phone
        <input className={styles.fieldInput} type="tel" name="phone" disabled={pending} />
      </label>
      <label className={styles.fieldLabel}>
        Message
        <textarea
          className={styles.fieldInput}
          name="message"
          rows={5}
          required
          disabled={pending}
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send message'}
      </Button>
    </form>
  );
}
