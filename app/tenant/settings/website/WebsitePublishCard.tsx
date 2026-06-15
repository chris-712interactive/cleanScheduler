'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { toggleWebsitePublishAction, type WebsiteActionState } from './actions';
import styles from './website-settings.module.scss';

export function WebsitePublishCard({
  tenantSlug,
  isPublished,
  previewUrl,
  trialPreview,
}: {
  tenantSlug: string;
  isPublished: boolean;
  previewUrl: string;
  trialPreview: boolean;
}) {
  const [publishState, publishAction, publishPending] = useActionState<
    WebsiteActionState,
    FormData
  >(toggleWebsitePublishAction, {});

  return (
    <section className={styles.setupCard}>
      {trialPreview ? (
        <p className={styles.trialNotice} role="status">
          Preview only — pages are hidden from search until you subscribe to a paid plan.
        </p>
      ) : null}

      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Publish</h2>
        <p className={styles.sectionLead}>
          When published, your public site is visible at the URL below.
        </p>
      </header>

      <p className={styles.previewUrl}>
        <Link href={previewUrl} className={styles.inlineLink} target="_blank" rel="noreferrer">
          {previewUrl}
        </Link>
      </p>

      <div className={styles.pageCardActions}>
        <StatusPill tone={isPublished ? 'success' : 'neutral'}>
          {isPublished ? 'Live' : 'Draft'}
        </StatusPill>
        <form action={publishAction}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="publish" value={isPublished ? 'false' : 'true'} />
          <Button type="submit" disabled={publishPending}>
            {isPublished ? 'Unpublish' : 'Publish website'}
          </Button>
        </form>
      </div>

      {publishState.error ? (
        <p className={styles.bannerError} role="alert">
          {publishState.error}
        </p>
      ) : null}
      {publishState.success ? (
        <p className={styles.bannerSuccess} role="status">
          {publishState.success}
        </p>
      ) : null}
    </section>
  );
}
