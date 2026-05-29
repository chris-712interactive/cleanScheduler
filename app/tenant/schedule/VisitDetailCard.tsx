'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { StatusPill } from '@/components/ui/StatusPill';
import { ScheduleAssigneeAvatars } from '@/components/schedule/ScheduleAssigneeAvatars';
import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';
import {
  formatCustomerPreferredBilling,
  isElectronicPreferredBilling,
} from '@/lib/tenant/customerBillingPreference';
import { CUSTOMER_PAYMENT_METHOD_LABEL, type TenantPaymentMethod } from '@/lib/tenant/operationalSettings';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import {
  resolveExpectedAmountCentsSync,
  visitHasBillableAmount,
} from '@/lib/billing/resolveVisitExpectedAmount';
import { formatVisitWhenRange } from '@/lib/datetime/formatInTimeZone';
import {
  canCheckInToVisit,
  canCompleteVisit,
  canManageScheduledVisit,
} from '@/lib/schedule/visitFieldWork';
import type { TenantRole } from '@/lib/auth/types';
import type { VisitProofPhotoRow } from '@/lib/visits/visitProofPhotos';
import {
  mergeVisitDetailPatch,
  type CollectedMethod,
  type VisitDetailPatch,
  type VisitStatus,
} from '@/lib/tenant/visitDetailPatch';
import { VisitProofPhotos } from '@/components/visits/VisitProofPhotos';
import { DeleteVisitButton } from './DeleteVisitButton';
import { VisitFieldWorkPanel } from './VisitFieldWorkPanel';
import { VisitTimeRescheduleForm } from './VisitTimeRescheduleForm';
import { VisitJobPriceForm } from './VisitJobPriceForm';
import styles from './visitDetail.module.scss';

const STATUS_LABEL = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
} as const;

const STATUS_TONE = {
  scheduled: 'info',
  completed: 'success',
  cancelled: 'neutral',
} as const;

function formatTimestamp(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone });
}

export type VisitDetailSnapshot = {
  visitId: string;
  tenantSlug: string;
  tenantTimezone: string;
  title: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string;
  siteLine: string;
  preferredPaymentMethod: TenantPaymentMethod | null;
  quoteTitle: string | null;
  quoteId: string | null;
  quoteAmountCents: number | null;
  notes: string | null;
  assignees: ScheduleAssigneeChip[];
  assigneeUserIds: string[];
  actorUserId: string;
  actorRole: TenantRole;
  isFieldEmployee: boolean;
  canUseProofPhotos: boolean;
  proofPhotosSharedWithCustomers: boolean;
  proofPhotos: VisitProofPhotoRow[];
  startsAt: string;
  endsAt: string;
  status: VisitStatus;
  expectedAmountCents: number | null;
  checkedInAt: string | null;
  completedAt: string | null;
  completionPaymentCollected: boolean | null;
  completionCollectedMethod: CollectedMethod | null;
  completionCollectedAmountCents: number | null;
  completionCheckNumber: string | null;
  completionInvoiceId: string | null;
};

export function VisitDetailCard({ initial }: { initial: VisitDetailSnapshot }) {
  const [visit, setVisit] = useState(initial);

  const onVisitPatch = useCallback((patch: VisitDetailPatch) => {
    setVisit((current) => mergeVisitDetailPatch(current, patch));
  }, []);

  const defaultAmountCents = useMemo(
    () =>
      resolveExpectedAmountCentsSync({
        expectedAmountCents: visit.expectedAmountCents,
        quoteAmountCents: visit.quoteAmountCents,
      }),
    [visit.expectedAmountCents, visit.quoteAmountCents],
  );

  const hasBillableAmount = visitHasBillableAmount({
    expectedAmountCents: visit.expectedAmountCents,
    quoteAmountCents: visit.quoteAmountCents,
  });

  const fieldParams = {
    status: visit.status,
    checkedInAt: visit.checkedInAt,
    actorUserId: visit.actorUserId,
    assigneeUserIds: visit.assigneeUserIds,
    actorRole: visit.actorRole,
  };

  const showCheckIn = canCheckInToVisit(fieldParams);
  const showComplete = canCompleteVisit(fieldParams);
  const canManage = canManageScheduledVisit(visit.actorRole);
  const canDelete = canManage;

  return (
    <Card title="Visit details">
      <div className={styles.stack}>
        <div>
          <StatusPill tone={STATUS_TONE[visit.status]}>{STATUS_LABEL[visit.status]}</StatusPill>
        </div>

        <div className={styles.detailGrid}>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>When</span>
            <p className={styles.detailValue}>
              {formatVisitWhenRange(visit.startsAt, visit.endsAt, visit.tenantTimezone)}
            </p>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Service</span>
            <p className={styles.detailValue}>{visit.title}</p>
          </div>
          {visit.siteLine ? (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Location</span>
              <p className={styles.detailValue}>{visit.siteLine}</p>
            </div>
          ) : null}
          {visit.customerPhone ? (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Customer phone</span>
              <p className={styles.detailValue}>
                <a href={`tel:${visit.customerPhone}`}>{visit.customerPhone}</a>
              </p>
            </div>
          ) : null}
          {visit.preferredPaymentMethod ? (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Billing preference</span>
              <p className={styles.detailValue}>
                {formatCustomerPreferredBilling(visit.preferredPaymentMethod)}
                {isElectronicPreferredBilling(visit.preferredPaymentMethod)
                  ? ' · Invoice via Stripe after service'
                  : ' · Collect on site'}
              </p>
            </div>
          ) : null}
          {hasBillableAmount && !(canManage && visit.status === 'scheduled') ? (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Job price</span>
              <p className={styles.detailValue}>
                ${formatCentsAsDollars(defaultAmountCents ?? 0)}
              </p>
            </div>
          ) : null}
          {visit.quoteTitle ? (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Quote</span>
              <p className={styles.detailValue}>
                {visit.quoteId && !visit.isFieldEmployee ? (
                  <Link href={`/quotes/${visit.quoteId}`}>{visit.quoteTitle}</Link>
                ) : (
                  visit.quoteTitle
                )}
              </p>
            </div>
          ) : null}
          {visit.notes ? (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Notes</span>
              <p className={styles.detailValue}>{visit.notes}</p>
            </div>
          ) : null}
          {formatTimestamp(visit.checkedInAt, visit.tenantTimezone) ? (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Checked in</span>
              <p className={styles.detailValue}>
                {formatTimestamp(visit.checkedInAt, visit.tenantTimezone)}
              </p>
            </div>
          ) : null}
          {formatTimestamp(visit.completedAt, visit.tenantTimezone) ? (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Completed</span>
              <p className={styles.detailValue}>
                {formatTimestamp(visit.completedAt, visit.tenantTimezone)}
              </p>
            </div>
          ) : null}
          {visit.completionPaymentCollected != null ? (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Payment at completion</span>
              <p className={styles.detailValue}>
                {visit.completionPaymentCollected
                  ? visit.completionCollectedMethod
                    ? `${CUSTOMER_PAYMENT_METHOD_LABEL[visit.completionCollectedMethod]} · $${formatCentsAsDollars(visit.completionCollectedAmountCents ?? 0)}${visit.completionCheckNumber ? ` · Check #${visit.completionCheckNumber}` : ''}`
                    : 'Collected on site'
                  : 'Not collected — invoice sent'}
                {visit.completionInvoiceId && !visit.isFieldEmployee ? (
                  <>
                    {' '}
                    <Link href={`/billing/invoices/${visit.completionInvoiceId}`}>
                      View invoice
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}
        </div>

        {visit.assignees.length > 0 ? (
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Crew</span>
            <div className={styles.crewRow}>
              <ScheduleAssigneeAvatars assignees={visit.assignees} size="lg" />
            </div>
          </div>
        ) : null}

        <VisitProofPhotos
          photos={visit.proofPhotos}
          description="Uploaded by your crew when this job was marked complete."
        />

        {canManage && visit.status === 'scheduled' ? (
          <VisitJobPriceForm
            tenantSlug={visit.tenantSlug}
            visitId={visit.visitId}
            currentAmountCents={defaultAmountCents}
            onVisitPatch={onVisitPatch}
          />
        ) : null}

        <VisitFieldWorkPanel
          tenantSlug={visit.tenantSlug}
          visitId={visit.visitId}
          canCheckIn={showCheckIn}
          canComplete={showComplete}
          checkedInAt={visit.checkedInAt}
          preferredPaymentMethod={visit.preferredPaymentMethod}
          defaultAmountCents={defaultAmountCents}
          customerHasEmail={Boolean(visit.customerEmail)}
          canAttachProofPhotos={visit.canUseProofPhotos}
          proofPhotosSharedWithCustomers={visit.proofPhotosSharedWithCustomers}
          isFieldEmployee={visit.isFieldEmployee}
          hasBillableAmount={hasBillableAmount}
          onVisitPatch={onVisitPatch}
        />

        {visit.status === 'scheduled' && !visit.checkedInAt && canManage ? (
          <VisitTimeRescheduleForm
            tenantSlug={visit.tenantSlug}
            tenantTimezone={visit.tenantTimezone}
            visitId={visit.visitId}
            startsAtIso={visit.startsAt}
            endsAtIso={visit.endsAt}
            onVisitPatch={onVisitPatch}
          />
        ) : null}

        {canDelete ? (
          <div className={styles.adminActions}>
            <h2 className={styles.sectionTitle}>Admin</h2>
            <DeleteVisitButton tenantSlug={visit.tenantSlug} visitId={visit.visitId} />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
