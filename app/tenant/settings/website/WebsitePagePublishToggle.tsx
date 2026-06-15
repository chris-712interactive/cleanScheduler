'use client';

import { useActionState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { toggleWebsitePagePublishAction, type WebsiteActionState } from './actions';
import styles from './website-settings.module.scss';

export function WebsitePagePublishToggle({
  tenantSlug,
  pageId,
  status,
  compact = false,
}: {
  tenantSlug: string;
  pageId: string;
  status: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const isPublished = status === 'published';
  const [state, action, pending] = useActionState<WebsiteActionState, FormData>(
    toggleWebsitePagePublishAction,
    {},
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <div className={compact ? styles.pageCardActions : styles.pagePublishControls}>
      <StatusPill tone={isPublished ? 'success' : 'neutral'}>
        {isPublished ? 'Published' : 'Draft'}
      </StatusPill>
      <form action={action}>
        <input type="hidden" name="tenant_slug" value={tenantSlug} />
        <input type="hidden" name="page_id" value={pageId} />
        <input type="hidden" name="publish" value={isPublished ? 'false' : 'true'} />
        <Button
          type="submit"
          variant={compact ? 'secondary' : 'primary'}
          size={compact ? 'sm' : 'md'}
          disabled={pending}
        >
          {isPublished ? 'Unpublish page' : 'Publish page'}
        </Button>
      </form>
      {state.error ? (
        <p className={styles.bannerError} role="alert">
          {state.error}
        </p>
      ) : null}
      {!compact && state.success ? (
        <p className={styles.bannerSuccess} role="status">
          {state.success}
        </p>
      ) : null}
    </div>
  );
}
