'use client';

import type { ReactNode } from 'react';
import styles from './campaigns.module.scss';

export function CampaignComposeLayout({ form, preview }: { form: ReactNode; preview: ReactNode }) {
  return (
    <div className={styles.composeLayout}>
      <div className={styles.formStack}>{form}</div>
      <div className={styles.previewColumn}>{preview}</div>
    </div>
  );
}
