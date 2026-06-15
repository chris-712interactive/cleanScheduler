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
    <section className={styles.statusBar}>
      <div className={styles.statusBarMain}>
        <StatusPill tone={isPublished ? 'success' : 'neutral'}>
          {isPublished ? 'Live' : 'Draft'}
        </StatusPill>
        <Link href={previewUrl} className={styles.statusBarUrl} target="_blank" rel="noreferrer">
          {previewUrl}
        </Link>
        {trialPreview ? (
          <span className={styles.statusBarHint}>Preview only until you subscribe</span>
        ) : null}
      </div>

      <div className={styles.statusBarActions}>
        <form action={publishAction}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="publish" value={isPublished ? 'false' : 'true'} />
          <Button type="submit" disabled={publishPending} size="sm">
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
