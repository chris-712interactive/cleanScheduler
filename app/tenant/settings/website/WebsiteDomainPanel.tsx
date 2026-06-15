'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { updateWebsiteDomainModeAction, type WebsiteActionState } from './actions';
import styles from './website-settings.module.scss';

export function WebsiteDomainPanel({
  tenantSlug,
  domainActive,
  siteMode,
  hostname,
}: {
  tenantSlug: string;
  domainActive: boolean;
  siteMode: 'portal_only' | 'unified';
  hostname: string | null;
}) {
  const [state, formAction, pending] = useActionState<WebsiteActionState, FormData>(
    updateWebsiteDomainModeAction,
    {},
  );

  if (!domainActive) {
    return (
      <section className={styles.settingsSection}>
        <header className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Custom domain</h2>
          <p className={styles.sectionLead}>
            Set up a custom domain in{' '}
            <Link href="/settings/customer-portal" className={styles.inlineLink}>
              Customer portal
            </Link>{' '}
            first, then return here to enable unified website + portal mode.
          </p>
        </header>
      </section>
    );
  }

  return (
    <section className={styles.settingsSection}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Unified domain</h2>
        <p className={styles.sectionLead}>
          Use {hostname} for both your public website and customer portal. Marketing pages live at
          `/`; customers sign in at `/portal`.
        </p>
      </header>

      <form action={formAction} className={styles.stack}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <label className={styles.fieldLabel}>
          Site mode
          <select className={styles.fieldInput} name="site_mode" defaultValue={siteMode}>
            <option value="portal_only">Portal only (entire domain → customer portal)</option>
            <option value="unified">Unified (website at /, portal at /portal)</option>
          </select>
        </label>
        {state.error ? (
          <p className={styles.bannerError} role="alert">
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p className={styles.bannerSuccess} role="status">
            {state.success}
          </p>
        ) : null}
        <Button type="submit" disabled={pending}>
          Save domain mode
        </Button>
      </form>
    </section>
  );
}
