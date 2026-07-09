import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { createOutreachCampaignFromCsvAction } from '@/lib/admin/outreachActions';
import styles from '../outreach.module.scss';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminOutreachNewPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const err = firstParam(sp.error);

  return (
    <>
      <PageHeader
        title="New outreach campaign"
        description="Import a mail-merge CSV. Required columns: Email, Subject, Body. Optional: Business Name, Owner Name, Phone, City, County, Type, Website, Notes."
      />

      {err ? (
        <p className={styles.formError} role="alert">
          {err}
        </p>
      ) : null}

      <Card title="Import contact sheet">
        <form action={createOutreachCampaignFromCsvAction} className={styles.formStack}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Campaign name</span>
            <input
              className={styles.input}
              type="text"
              name="name"
              required
              maxLength={120}
              placeholder="SWFL cleaning outreach — July 2026"
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>CSV file</span>
            <input
              className={styles.input}
              type="file"
              name="csv"
              accept=".csv,text/csv"
              required
            />
            <p className={styles.fieldHint}>
              Each row needs its own Subject and Body. Suppressed emails are imported as skipped.
            </p>
          </label>
          <div className={styles.actionsRow}>
            <Button type="submit" variant="primary">
              Create draft
            </Button>
            <Button variant="secondary" as="a" href="/outreach">
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
