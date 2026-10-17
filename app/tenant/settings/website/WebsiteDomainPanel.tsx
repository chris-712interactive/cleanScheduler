'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { useFeedbackToast } from '@/components/ui/FeedbackToast';
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
  useFeedbackToast({ error: state.error, success: state.success, pending });

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
        <Button type="submit" disabled={pending}>
          Save domain mode
        </Button>
      </form>
    </section>
  );
}
