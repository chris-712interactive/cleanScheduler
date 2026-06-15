'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { Button } from '@/components/ui/Button';
import { createWebsitePageAction, type WebsiteActionState } from './actions';
import { WebsitePagePublishToggle } from './WebsitePagePublishToggle';
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
    <section className={styles.setupCard}>
      <header className={styles.sectionHeaderCompact}>
        <div>
          <h2 className={styles.sectionTitle}>Pages</h2>
          <p className={styles.sectionLead}>
            {pages.length} page{pages.length === 1 ? '' : 's'} · draft pages stay hidden when live
          </p>
        </div>
      </header>

      <ul className={styles.pageList}>
        {pages.map((page) => (
          <li key={page.id} className={styles.pageRow}>
            <div className={styles.pageRowMain}>
              <span className={styles.pageRowTitle}>{page.headline || page.slug}</span>
              <span className={styles.pageRowMeta}>
                /{page.slug} · {page.pageType.replace('_', ' ')}
              </span>
            </div>
            <div className={styles.pageRowActions}>
              <WebsitePagePublishToggle
                tenantSlug={tenantSlug}
                pageId={page.id}
                status={page.status}
                compact
              />
              <Link href={`/settings/website/${page.id}`} className={styles.inlineLink}>
                Edit
              </Link>
            </div>
          </li>
        ))}
      </ul>

      {canCreatePage ? (
        <form action={formAction} className={styles.addPageForm}>
          <input type="hidden" name="tenant_slug" value={tenantSlug} />
          <input type="hidden" name="page_type" value="custom" />
          <label className={styles.fieldLabel}>
            <span className={styles.addPageLabel}>New page slug</span>
            <input className={styles.fieldInput} name="slug" placeholder="service-area-austin" />
          </label>
          <label className={styles.fieldLabel}>
            <span className={styles.addPageLabel}>Headline</span>
            <input className={styles.fieldInput} name="headline" placeholder="Cleaning in Austin" />
          </label>
          <Button type="submit" disabled={pending} size="sm">
            Add page
          </Button>
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
        </form>
      ) : null}
    </section>
  );
}
