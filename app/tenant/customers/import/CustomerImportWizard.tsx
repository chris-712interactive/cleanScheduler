'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UpgradeOrAddOnModal } from '@/components/billing/UpgradeOrAddOnModal';
import { Button } from '@/components/ui/Button';
import { commitCustomerImport, previewCustomerImport } from '@/app/tenant/customers/importActions';
import type {
  CustomerImportCommitResult,
  CustomerImportPreview,
  CustomerImportSkipReason,
} from '@/lib/tenant/customerImport/types';
import styles from './import.module.scss';

function actionLabel(
  action: CustomerImportPreview['rows'][number]['action'],
  reason: CustomerImportSkipReason | null,
): string {
  if (action === 'create') return 'New customer';
  if (action === 'add_properties') return 'Add properties';
  if (reason === 'archived') return 'Skip archived';
  if (reason === 'missing_name') return 'Skip, no name';
  if (reason === 'duplicate') return 'Already imported';
  return 'Skip';
}

export function CustomerImportWizard({ tenantSlug }: { tenantSlug: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [skipArchived, setSkipArchived] = useState(true);
  const [includeCustomFields, setIncludeCustomFields] = useState(false);
  const [pending, setPending] = useState<'preview' | 'commit' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<CustomerImportPreview | null>(null);
  const [result, setResult] = useState<CustomerImportCommitResult | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  function formData(): FormData | null {
    if (!file) {
      setError('Choose a CSV file to import.');
      return null;
    }
    const data = new FormData();
    data.set('tenant_slug', tenantSlug);
    data.set('file', file);
    data.set('skip_archived', skipArchived ? 'on' : 'off');
    data.set('include_custom_fields', includeCustomFields ? 'on' : 'off');
    return data;
  }

  async function onPreview() {
    const data = formData();
    if (!data) return;
    setPending('preview');
    setError(null);
    setResult(null);
    const next = await previewCustomerImport(data);
    setPending(null);
    if (!next.ok) {
      setPreview(null);
      setError(next.error);
      return;
    }
    setPreview(next);
    if (next.plan.blocked) setUpgradeOpen(true);
  }

  async function onCommit() {
    if (!preview || preview.plan.blocked) {
      setUpgradeOpen(true);
      return;
    }
    const data = formData();
    if (!data) return;
    setPending('commit');
    setError(null);
    const next = await commitCustomerImport(data);
    setPending(null);
    if (!next.ok) {
      setError(next.error ?? 'Import failed.');
      if (next.limitExceeded) setUpgradeOpen(true);
      return;
    }
    setResult(next);
    setPreview(null);
  }

  const canCommit =
    preview != null &&
    !preview.plan.blocked &&
    (preview.counts.newCustomers > 0 || preview.counts.properties > 0);

  return (
    <div className={styles.panel}>
      <UpgradeOrAddOnModal
        open={upgradeOpen}
        title="Customer limit reached"
        message={
          preview?.plan.message ??
          error ??
          'Your workspace has reached its customer limit. Upgrade your plan to import more customers.'
        }
        onClose={() => setUpgradeOpen(false)}
      />

      <p className={styles.hint}>
        In Jobber, open Clients and export that list. Do not export jobs or invoices. We create
        customers and service properties only — no portal invites, visits, or invoices.
      </p>

      <label className={styles.hint} htmlFor="customer-import-file">
        CSV file
      </label>
      <input
        id="customer-import-file"
        className={styles.fileInput}
        type="file"
        accept=".csv,text/csv,text/plain"
        onChange={(event) => {
          setFile(event.target.files?.[0] ?? null);
          setPreview(null);
          setResult(null);
          setError(null);
        }}
      />

      <div className={styles.options}>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={skipArchived}
            onChange={(event) => {
              setSkipArchived(event.target.checked);
              setPreview(null);
            }}
          />
          <span>Skip archived Jobber clients</span>
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={includeCustomFields}
            onChange={(event) => {
              setIncludeCustomFields(event.target.checked);
              setPreview(null);
            }}
          />
          <span>Include extra Jobber custom fields in notes</span>
        </label>
      </div>

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.actions}>
        <Button
          type="button"
          variant="secondary"
          loading={pending === 'preview'}
          onClick={onPreview}
        >
          Preview import
        </Button>
        {preview ? (
          <Button
            type="button"
            variant="primary"
            loading={pending === 'commit'}
            disabled={!canCommit || pending != null}
            onClick={onCommit}
          >
            {preview.counts.newCustomers > 0
              ? `Import ${preview.counts.newCustomers} customers`
              : `Add ${preview.counts.properties} properties`}
          </Button>
        ) : null}
      </div>

      {preview ? (
        <section className={styles.panel} aria-live="polite">
          <p className={styles.hint}>
            {preview.source === 'jobber'
              ? 'This looks like a Jobber client export.'
              : 'This looks like a customer spreadsheet. Columns were matched by header name.'}
          </p>
          <ul className={styles.counts}>
            <li className={styles.count}>
              <span className={styles.countValue}>{preview.counts.newCustomers}</span>
              <span className={styles.countLabel}>New customers</span>
            </li>
            <li className={styles.count}>
              <span className={styles.countValue}>{preview.counts.properties}</span>
              <span className={styles.countLabel}>Properties</span>
            </li>
            <li className={styles.count}>
              <span className={styles.countValue}>{preview.counts.duplicates}</span>
              <span className={styles.countLabel}>Already here</span>
            </li>
            <li className={styles.count}>
              <span className={styles.countValue}>{preview.counts.skipped}</span>
              <span className={styles.countLabel}>Skipped</span>
            </li>
          </ul>
          {preview.plan.message ? (
            <p className={styles.planNote} data-blocked={preview.plan.blocked || undefined}>
              {preview.plan.message}
            </p>
          ) : null}
          <p className={styles.columns}>
            Mapped: {preview.mappedColumns.slice(0, 12).join(', ') || 'none'}
            {preview.ignoredColumns.length > 0
              ? `. Ignored ${preview.ignoredColumns.length} other column${preview.ignoredColumns.length === 1 ? '' : 's'}.`
              : '.'}
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Properties</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, index) => (
                  <tr key={`${row.name}-${row.email ?? ''}-${index}`}>
                    <td>{row.name}</td>
                    <td>{row.email ?? '—'}</td>
                    <td>{row.phone ?? '—'}</td>
                    <td>
                      {row.propertySummary || (row.propertyCount > 0 ? row.propertyCount : '—')}
                    </td>
                    <td>
                      {actionLabel(row.action, row.skipReason)}
                      {row.warnings.slice(0, 2).map((warning) => (
                        <p key={warning} className={styles.warning}>
                          {warning}
                        </p>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.totalDrafts > preview.rows.length ? (
            <p className={styles.hint}>
              Showing the first {preview.rows.length} of {preview.totalDrafts} clients.
            </p>
          ) : null}
        </section>
      ) : null}

      {result?.ok ? (
        <section className={styles.result} aria-live="polite">
          <p>
            Imported {result.created ?? 0} customers and {result.propertiesAdded ?? 0} properties.
            {result.skipped ? ` Skipped ${result.skipped}.` : ''}
            {result.failed ? ` ${result.failed} could not be saved.` : ''}
          </p>
          {result.error ? <p className={styles.error}>{result.error}</p> : null}
          <Link href="/customers">Back to customers</Link>
        </section>
      ) : null}
    </div>
  );
}
