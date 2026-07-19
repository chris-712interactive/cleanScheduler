'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Phone } from 'lucide-react';
import { StatusPill } from '@/components/ui/StatusPill';
import { ScheduleAssigneeAvatars } from '@/components/schedule/ScheduleAssigneeAvatars';
import type { ScheduleAssigneeChip } from '@/lib/schedule/assigneeDisplay';
import {
  formatCustomerPreferredBilling,
  isElectronicPreferredBilling,
} from '@/lib/tenant/customerBillingPreference';
import {
  CUSTOMER_PAYMENT_METHOD_LABEL,
  type TenantPaymentMethod,
} from '@/lib/tenant/operationalSettings';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import {
  resolveExpectedAmountCentsSync,
  visitHasBillableAmount,
} from '@/lib/billing/resolveVisitExpectedAmount';
import { formatVisitDuration, formatVisitWhenRange } from '@/lib/datetime/formatInTimeZone';
import {
  canCheckInToVisit,
  canCompleteVisit,
  canManageScheduledVisit,
} from '@/lib/schedule/visitFieldWork';
import type { TenantRole } from '@/lib/auth/types';
import type { VisitProofPhotoRow } from '@/lib/visits/visitProofPhotos';
import type { VisitChecklistItem } from '@/lib/visits/visitChecklist';
import type { RelatedRecordsSnapshot } from '@/lib/tenant/relatedRecordsTypes';
import {
  mergeVisitDetailPatch,
  type CheckInLocationStatus,
  type CollectedMethod,
  type VisitDetailPatch,
  type VisitStatus,
} from '@/lib/tenant/visitDetailPatch';
import { formatCheckInLocationProof } from '@/lib/schedule/checkInLocation';
import { VisitProofPhotos } from '@/components/visits/VisitProofPhotos';
import { DeleteVisitButton } from './DeleteVisitButton';
import { VisitFieldWorkPanel } from './VisitFieldWorkPanel';
import { VisitChecklistPanel } from './VisitChecklistPanel';
import { VisitScheduleEditPanel } from './VisitScheduleEditPanel';
import { VisitJobPriceForm } from './VisitJobPriceForm';
import type { EmployeeOption } from './ScheduleVisitForm';
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
  canUseGpsCheckIn: boolean;
  proofPhotosSharedWithCustomers: boolean;
  proofPhotos: VisitProofPhotoRow[];
  startsAt: string;
  endsAt: string;
  durationHours: number;
  durationSourceLabel: string;
  status: VisitStatus;
  expectedAmountCents: number | null;
  checkedInAt: string | null;
  checkInLat: number | null;
  checkInLng: number | null;
  checkInAccuracyM: number | null;
  checkInLocationStatus: CheckInLocationStatus | null;
  completedAt: string | null;
  completionPaymentCollected: boolean | null;
  completionCollectedMethod: CollectedMethod | null;
  completionCollectedAmountCents: number | null;
  completionCheckNumber: string | null;
  completionInvoiceId: string | null;
  visitPurpose: 'service' | 'consultation';
  checklistItems: VisitChecklistItem[];
};

export function VisitDetailCard({
  initial,
  employeeOptions = [],
  relatedRecords,
  scrollToFieldActions = false,
}: {
  initial: VisitDetailSnapshot;
  employeeOptions?: EmployeeOption[];
  relatedRecords?: RelatedRecordsSnapshot | null;
  scrollToFieldActions?: boolean;
}) {
  const [visit, setVisit] = useState(initial);

  useEffect(() => {
    if (!scrollToFieldActions) return;
    document
      .getElementById('field-actions')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollToFieldActions]);

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

  const isConsultation = visit.visitPurpose === 'consultation';

  const hasBillableAmount =
    isConsultation ||
    visitHasBillableAmount({
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
  const showScheduleEdit =
    visit.status === 'scheduled' && !visit.checkedInAt && canManage && !visit.isFieldEmployee;
  const showFieldWork = showCheckIn || showComplete;
  const durationLabel = formatVisitDuration(visit.startsAt, visit.endsAt);
  const whenLabel = formatVisitWhenRange(visit.startsAt, visit.endsAt, visit.tenantTimezone);
  const priceLabel = isConsultation
    ? 'Consultation'
    : hasBillableAmount
      ? `$${formatCentsAsDollars(defaultAmountCents ?? 0)}`
      : 'Price needed';

  const checkInLocationProof =
    visit.canUseGpsCheckIn && visit.checkInLocationStatus
      ? formatCheckInLocationProof({
          status: visit.checkInLocationStatus,
          lat: visit.checkInLat,
          lng: visit.checkInLng,
          accuracyM: visit.checkInAccuracyM,
        })
      : null;

  return (
    <div className={styles.workspace}>
      <div className={styles.summaryStrip} aria-label="Appointment overview">
        <StatusPill tone={STATUS_TONE[visit.status]}>{STATUS_LABEL[visit.status]}</StatusPill>
        <span className={styles.summaryDivider} aria-hidden />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>When</span>
          <span className={styles.summaryValue}>{whenLabel}</span>
          {durationLabel ? <span className={styles.summaryMuted}>({durationLabel})</span> : null}
        </div>
        <span className={styles.summaryDivider} aria-hidden />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Crew</span>
          {visit.assignees.length > 0 ? (
            <ScheduleAssigneeAvatars assignees={visit.assignees} size="sm" />
          ) : (
            <span className={styles.summaryMuted}>Unassigned</span>
          )}
        </div>
        <span className={styles.summaryDivider} aria-hidden />
        <div className={styles.summaryItem}>
          <span className={styles.summaryLabel}>Price</span>
          <span
            className={hasBillableAmount ? styles.summaryValue : styles.summaryMuted}
            data-warn={!hasBillableAmount || undefined}
          >
            {priceLabel}
          </span>
        </div>
      </div>

      <div className={styles.workspaceGrid}>
        <div className={styles.workspaceMain}>
          {showScheduleEdit ? (
            <VisitScheduleEditPanel
              tenantSlug={visit.tenantSlug}
              tenantTimezone={visit.tenantTimezone}
              visitId={visit.visitId}
              startsAtIso={visit.startsAt}
              endsAtIso={visit.endsAt}
              durationHours={visit.durationHours}
              durationSourceLabel={visit.durationSourceLabel}
              currentAssigneeUserIds={visit.assigneeUserIds}
              employeeOptions={employeeOptions}
              isConsultation={isConsultation}
              onVisitPatch={onVisitPatch}
            />
          ) : null}

          {showFieldWork ? (
            <section
              id="field-actions"
              className={styles.panel}
              aria-labelledby="field-actions-heading"
            >
              <h2 id="field-actions-heading" className={styles.panelTitle}>
                Field actions
              </h2>
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
                canUseGpsCheckIn={visit.canUseGpsCheckIn}
                proofPhotosSharedWithCustomers={visit.proofPhotosSharedWithCustomers}
                isFieldEmployee={visit.isFieldEmployee}
                hasBillableAmount={hasBillableAmount}
                isConsultation={isConsultation}
                initialNotes={visit.notes ?? ''}
                onVisitPatch={onVisitPatch}
                compact
              />
            </section>
          ) : null}

          {visit.checklistItems.length > 0 ? (
            <VisitChecklistPanel
              tenantSlug={visit.tenantSlug}
              visitId={visit.visitId}
              items={visit.checklistItems}
              readOnly={visit.status === 'completed' || visit.status === 'cancelled'}
            />
          ) : null}

          {visit.proofPhotos.length > 0 ? (
            <section className={`${styles.panel} ${styles.proofPanel}`}>
              <VisitProofPhotos
                photos={visit.proofPhotos}
                description="Proof photos from completion."
              />
            </section>
          ) : null}
        </div>

        <aside className={styles.workspaceAside}>
          <section className={styles.panel} aria-labelledby="customer-heading">
            <h2 id="customer-heading" className={styles.panelTitle}>
              Customer &amp; visit
            </h2>
            <dl className={styles.metaList}>
              <div className={styles.metaRow}>
                <dt className={styles.metaLabel}>Service</dt>
                <dd className={styles.metaValue}>{visit.title}</dd>
              </div>
              {visit.siteLine ? (
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>Location</dt>
                  <dd className={styles.metaValue}>
                    <MapPin size={14} aria-hidden style={{ verticalAlign: '-2px' }} />{' '}
                    {visit.siteLine}
                  </dd>
                </div>
              ) : null}
              {visit.customerPhone ? (
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>Phone</dt>
                  <dd className={styles.metaValue}>
                    <Phone size={14} aria-hidden style={{ verticalAlign: '-2px' }} />{' '}
                    <a href={`tel:${visit.customerPhone}`}>{visit.customerPhone}</a>
                  </dd>
                </div>
              ) : null}
              {visit.customerEmail ? (
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>Email</dt>
                  <dd className={styles.metaValue}>
                    <a href={`mailto:${visit.customerEmail}`}>{visit.customerEmail}</a>
                  </dd>
                </div>
              ) : null}
              {visit.preferredPaymentMethod ? (
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>Billing</dt>
                  <dd className={styles.metaValue}>
                    {formatCustomerPreferredBilling(visit.preferredPaymentMethod)}
                    {isElectronicPreferredBilling(visit.preferredPaymentMethod)
                      ? ' · Invoice after service'
                      : ' · Collect on site'}
                  </dd>
                </div>
              ) : null}
              {visit.quoteTitle ? (
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>Quote</dt>
                  <dd className={styles.metaValue}>
                    {visit.quoteId && !visit.isFieldEmployee ? (
                      <Link href={`/quotes/${visit.quoteId}`}>{visit.quoteTitle}</Link>
                    ) : (
                      visit.quoteTitle
                    )}
                  </dd>
                </div>
              ) : null}
              {formatTimestamp(visit.checkedInAt, visit.tenantTimezone) ? (
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>Checked in</dt>
                  <dd className={styles.metaValue}>
                    {formatTimestamp(visit.checkedInAt, visit.tenantTimezone)}
                  </dd>
                </div>
              ) : null}
              {checkInLocationProof ? (
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>Check-in location</dt>
                  <dd className={styles.metaValue}>
                    {checkInLocationProof.mapsUrl ? (
                      <a
                        href={checkInLocationProof.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {checkInLocationProof.label}
                      </a>
                    ) : (
                      checkInLocationProof.label
                    )}
                  </dd>
                </div>
              ) : null}
              {formatTimestamp(visit.completedAt, visit.tenantTimezone) ? (
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>Completed</dt>
                  <dd className={styles.metaValue}>
                    {formatTimestamp(visit.completedAt, visit.tenantTimezone)}
                  </dd>
                </div>
              ) : null}
              {visit.completionPaymentCollected != null ? (
                <div className={styles.metaRow}>
                  <dt className={styles.metaLabel}>Payment</dt>
                  <dd className={styles.metaValue}>
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
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          {relatedRecords && relatedRecords.links.length > 0 ? (
            <section className={styles.panel} aria-labelledby="related-heading">
              <h2 id="related-heading" className={styles.panelTitle}>
                Related
              </h2>
              <ul className={styles.relatedLinks}>
                {relatedRecords.links.map((link) => (
                  <li key={`${link.href}-${link.label}`}>
                    <Link href={link.href} className={styles.relatedLink} title={link.detail}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {visit.notes ? (
            <section className={styles.panel} aria-labelledby="notes-heading">
              <h2 id="notes-heading" className={styles.panelTitle}>
                Notes
              </h2>
              <p className={styles.notesBlock}>{visit.notes}</p>
            </section>
          ) : null}

          {canManage && visit.status === 'scheduled' ? (
            <section className={styles.panel} aria-labelledby="price-heading">
              <h2 id="price-heading" className={styles.panelTitle}>
                Job price
              </h2>
              <VisitJobPriceForm
                tenantSlug={visit.tenantSlug}
                visitId={visit.visitId}
                currentAmountCents={defaultAmountCents}
                onVisitPatch={onVisitPatch}
                compact
              />
            </section>
          ) : null}

          {canDelete ? (
            <section className={styles.panel}>
              <div className={styles.adminRow}>
                <p className={styles.adminHint}>Permanently remove this visit from the schedule.</p>
                <DeleteVisitButton tenantSlug={visit.tenantSlug} visitId={visit.visitId} />
              </div>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
