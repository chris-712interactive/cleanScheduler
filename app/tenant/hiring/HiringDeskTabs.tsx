'use client';

import { useState, type ReactNode } from 'react';
import styles from './hiring.module.scss';

export function HiringDeskTabs({
  applicantCount,
  timeCount,
  exportHref,
  applicants,
  times,
}: {
  applicantCount: number;
  timeCount: number;
  exportHref: string | null;
  applicants: ReactNode;
  times: ReactNode;
}) {
  const [tab, setTab] = useState<'applicants' | 'times'>('applicants');

  return (
    <section className={styles.primary}>
      <div className={styles.sectionHead}>
        <div className={styles.deskTabs} role="tablist" aria-label="Hiring desk">
          <button
            type="button"
            role="tab"
            id="applicants-tab"
            className={styles.deskTab}
            aria-selected={tab === 'applicants'}
            aria-controls="applicants-panel"
            onClick={() => setTab('applicants')}
          >
            Applicants
            <span className={styles.deskTabCount}>{applicantCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="times-tab"
            className={styles.deskTab}
            aria-selected={tab === 'times'}
            aria-controls="times-panel"
            onClick={() => setTab('times')}
          >
            Interview times
            <span className={styles.deskTabCount}>{timeCount}</span>
          </button>
        </div>
        {tab === 'applicants' && exportHref ? (
          <a className={styles.textLink} href={exportHref}>
            Download CSV
          </a>
        ) : null}
      </div>
      <div
        role="tabpanel"
        id="applicants-panel"
        aria-labelledby="applicants-tab"
        hidden={tab !== 'applicants'}
      >
        {applicants}
      </div>
      <div role="tabpanel" id="times-panel" aria-labelledby="times-tab" hidden={tab !== 'times'}>
        {times}
      </div>
    </section>
  );
}
