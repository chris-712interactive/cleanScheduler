import { PageHeader } from '@/components/portal/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Stack } from '@/components/layout/Stack';
import {
  createOutreachCampaignFromCsvAction,
  createOutreachCampaignFromSheetUrlAction,
} from '@/lib/admin/outreachActions';
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
        description="Import a mail-merge contact list from a CSV file or a published Google Sheet. Required columns: Email, Subject, Body. Optional: Business Name, Owner Name, Phone, City, County, Type, Website, Notes."
      />

      {err ? (
        <p className={styles.formError} role="alert">
          {err}
        </p>
      ) : null}

      <Stack gap={5}>
        <Card title="Upload CSV file">
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
                Create draft from file
              </Button>
              <Button variant="secondary" as="a" href="/outreach">
                Cancel
              </Button>
            </div>
          </form>
        </Card>

        <Card title="Import published Google Sheet">
          <form action={createOutreachCampaignFromSheetUrlAction} className={styles.formStack}>
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
              <span className={styles.fieldLabel}>Published CSV URL</span>
              <input
                className={styles.input}
                type="url"
                name="sheetUrl"
                required
                placeholder="https://docs.google.com/spreadsheets/d/e/…/pub?output=csv"
              />
              <p className={styles.fieldHint}>
                In Google Sheets: File → Share → Publish to web → choose the tab → CSV → Publish,
                then paste the link. Anyone with the link can read the sheet data.
              </p>
            </label>
            <div className={styles.actionsRow}>
              <Button type="submit" variant="primary">
                Create draft from sheet
              </Button>
            </div>
          </form>
        </Card>
      </Stack>
    </>
  );
}
