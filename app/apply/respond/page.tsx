import type { Metadata } from 'next';
import { loadHiringTokenView } from '@/lib/hiring/engine';
import { createAdminClient } from '@/lib/supabase/server';
import { RespondForm } from './RespondForm';
import styles from '../apply.module.scss';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Application',
  robots: { index: false, follow: false },
};

export default async function HiringRespondPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token?.trim() ?? '';
  const admin = createAdminClient();
  const view = await loadHiringTokenView(admin, token, new Date());

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        {view.state === 'invalid' ? (
          <p className={styles.unavailable}>This link is not valid.</p>
        ) : null}
        {view.state === 'used' ? (
          <p className={styles.unavailable}>This link was already used.</p>
        ) : null}
        {view.state === 'expired' ? (
          <p className={styles.unavailable}>This link has expired.</p>
        ) : null}
        {view.state === 'ready' ? (
          <>
            <h1 className={styles.brand}>{view.company}</h1>
            <p className={styles.kicker}>{view.title}</p>
            {view.when ? (
              <dl className={styles.facts}>
                <div>
                  <dt>Time</dt>
                  <dd>{view.when}</dd>
                </div>
                <div>
                  <dt>Format</dt>
                  <dd>{view.interviewLabel}</dd>
                </div>
                {view.meeting ? (
                  <div>
                    <dt>Where</dt>
                    <dd>{view.meeting}</dd>
                  </div>
                ) : null}
                {view.payText ? (
                  <div>
                    <dt>Pay</dt>
                    <dd>{view.payText}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className={styles.lead}>This removes your contact details from the application.</p>
            )}
            <RespondForm token={token} purpose={view.purpose ?? 'confirm'} />
          </>
        ) : null}
      </div>
    </main>
  );
}
