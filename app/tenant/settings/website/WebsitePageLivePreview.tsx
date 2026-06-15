'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { TenantSitePageView } from '@/components/tenantSite/TenantSitePage';
import type { TenantSiteContext, TenantSitePageContent } from '@/lib/tenantSite/types';
import styles from './website-settings.module.scss';

const PREVIEW_WIDTH_PX = 1024;

const PREVIEW_NAV_LINKS = [
  { href: '#preview', label: 'Home' },
  { href: '#preview', label: 'Services' },
  { href: '#preview', label: 'Contact' },
];

export function WebsitePageLivePreview({
  site,
  page,
  pageId,
}: {
  site: TenantSiteContext & { tenantId: string };
  page: TenantSitePageContent;
  pageId: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState({ scale: 0.35, height: 480 });

  const previewPage = useMemo(
    () => ({
      ...page,
      headline: page.headline.trim() || 'Page headline',
      eyebrow: page.eyebrow.trim(),
      lead: page.lead.trim(),
      sections: page.sections.map((section, index) => ({
        ...section,
        title: section.title.trim() || `Section ${index + 1}`,
        paragraphs: (section.paragraphs ?? []).filter((value) => value.trim()),
        bullets: (section.bullets ?? []).filter((value) => value.trim()),
      })),
      faq: page.faq.filter((item) => item.question.trim() || item.answer.trim()),
    }),
    [page],
  );

  useEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    const updateLayout = () => {
      const scale = frame.clientWidth / PREVIEW_WIDTH_PX;
      setLayout({
        scale,
        height: content.scrollHeight * scale,
      });
    };

    updateLayout();

    const frameObserver = new ResizeObserver(updateLayout);
    const contentObserver = new ResizeObserver(updateLayout);
    frameObserver.observe(frame);
    contentObserver.observe(content);

    return () => {
      frameObserver.disconnect();
      contentObserver.disconnect();
    };
  }, [previewPage]);

  return (
    <aside className={styles.livePreviewPanel} aria-label="Live page preview">
      <div className={styles.livePreviewHeader}>
        <h2 className={styles.livePreviewTitle}>Live preview</h2>
        <p className={styles.livePreviewHint}>
          Updates as you edit. Saved changes appear on your site.
        </p>
      </div>

      <div ref={frameRef} className={styles.livePreviewFrame}>
        <div className={styles.livePreviewSizer} style={{ height: layout.height }}>
          <div
            ref={contentRef}
            className={styles.livePreviewCanvas}
            style={{
              width: PREVIEW_WIDTH_PX,
              transform: `scale(${layout.scale})`,
            }}
          >
            <TenantSitePageView
              site={site}
              page={previewPage}
              headerNavLinks={PREVIEW_NAV_LINKS}
              footerNavLinks={PREVIEW_NAV_LINKS}
              pageId={pageId}
              showPoweredBy={false}
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
