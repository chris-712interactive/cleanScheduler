'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { StatusPill } from '@/components/ui/StatusPill';
import { createWebsitePageAction, type WebsiteActionState } from './actions';
import styles from './website-settings.module.scss';

type PageItem = {
  id: string;
  slug: string;
  pageType: string;
  status: string;
  headline: string;
};

export function WebsitePageListPanel({
  tenantSlug,
  pages,
  canCreatePage,
}: {
  tenantSlug: string;
  pages: PageItem[];
  canCreatePage: boolean;
}) {
  const [state, formAction, pending] = useActionState<WebsiteActionState, FormData>(
    createWebsitePageAction,
    {},
  );

  return (
    <section className={styles.settingsSection}>
      <header className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Pages</h2>
        <p className={styles.sectionLead}>Manage content for your public marketing website.</p>
      </header>

      <div className={styles.pageList}>
        {pages.map((page) => (
          <article key={page.id} className={styles.pageCard}>
            <div>
              <h3 className={styles.pageCardTitle}>{page.headline || page.slug}</h3>
              <p className={styles.pageCardMeta}>
                /{page.slug} · {page.pageType.replace('_', ' ')}
              </p>
            </div>
            <div className={styles.pageCardActions}>
              <StatusPill tone={page.status === 'published' ? 'success' : 'neutral'}>
                {page.status === 'published' ? 'Published' : 'Draft'}
              </StatusPill>
              <Link href={`/settings/website/${page.id}`} className={styles.inlineLink}>
                Edit
              </Link>
            </div>
          </article>
        ))}
      </div>

      {canCreatePage ? (
        <form action={formAction} className={styles.stack}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="page_type" value="custom" />
          <div className={styles.formGrid}>
            <label className={styles.fieldLabel}>
              New page slug
              <input className={styles.fieldInput} name="slug" placeholder="service-area-austin" />
            </label>
            <label className={styles.fieldLabel}>
              Headline
              <input
                className={styles.fieldInput}
                name="headline"
                placeholder="Cleaning in Austin"
              />
            </label>
          </div>
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
            Add page
          </Button>
        </form>
      ) : null}
    </section>
  );
}
