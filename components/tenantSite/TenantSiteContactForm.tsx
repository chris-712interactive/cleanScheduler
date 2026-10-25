'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
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
  useFeedbackToast({
    error: state.error,
    success: state.success,
    successMessage: 'Thanks — we received your message and will follow up soon.',
    pending,
  });

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

      <label className={styles.fieldLabel} htmlFor="tenant-site-name">
        Full name
        <input
          id="tenant-site-name"
          className={styles.fieldInput}
          name="name"
          autoComplete="name"
          required
          disabled={pending}
        />
      </label>
      <label className={styles.fieldLabel} htmlFor="tenant-site-email">
        Email
        <input
          id="tenant-site-email"
          className={styles.fieldInput}
          type="email"
          name="email"
          autoComplete="email"
          required
          disabled={pending}
        />
      </label>
      <label className={styles.fieldLabel} htmlFor="tenant-site-phone">
        Phone
        <input
          id="tenant-site-phone"
          className={styles.fieldInput}
          type="tel"
          name="phone"
          autoComplete="tel"
          disabled={pending}
        />
      </label>
      <label className={styles.fieldLabel} htmlFor="tenant-site-city">
        City
        <input
          id="tenant-site-city"
          className={styles.fieldInput}
          name="service_city"
          autoComplete="address-level2"
          disabled={pending}
        />
      </label>
      <label className={styles.fieldLabel} htmlFor="tenant-site-message">
        What do you need cleaned?
        <textarea
          id="tenant-site-message"
          className={styles.fieldInput}
          name="message"
          rows={5}
          required
          disabled={pending}
        />
      </label>
      <Button type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Request a quote'}
      </Button>
    </form>
  );
}
