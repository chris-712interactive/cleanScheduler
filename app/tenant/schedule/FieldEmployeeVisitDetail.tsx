'use client';

import { MapPin, Navigation, Phone } from 'lucide-react';
import { formatCentsAsDollars } from '@/lib/billing/parseMoney';
import { googleMapsDirectionsUrl } from '@/lib/geo/googleMapsDirectionsUrl';
import { formatDateTimeInTimeZone, formatVisitTime } from '@/lib/datetime/formatInTimeZone';
import { VisitChecklistPanel } from './VisitChecklistPanel';
import { VisitFieldWorkPanel } from './VisitFieldWorkPanel';
import { VisitProofPhotos } from '@/components/visits/VisitProofPhotos';
import type { VisitDetailPatch } from '@/lib/tenant/visitDetailPatch';
import { ConsultationIntakeForm } from './ConsultationIntakeForm';
import type { VisitDetailSnapshot } from './VisitDetailCard';
import styles from './visitDetail.module.scss';

function statusLabel(visit: VisitDetailSnapshot): string {
  if (visit.status === 'completed') return 'Done';
  if (visit.status === 'cancelled') return 'Cancelled';
  if (visit.checkedInAt) return 'Checked in';
  return 'Scheduled';
}

function clockTime(iso: string | null, timeZone: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-US', { timeStyle: 'short', timeZone });
}

export function FieldEmployeeVisitDetail({
  visit,
  showFieldWork,
  showCheckIn,
  showComplete,
  defaultAmountCents,
  hasBillableAmount,
  onVisitPatch,
}: {
  visit: VisitDetailSnapshot;
  showFieldWork: boolean;
  showCheckIn: boolean;
  showComplete: boolean;
  defaultAmountCents: number | null;
  hasBillableAmount: boolean;
  onVisitPatch: (patch: VisitDetailPatch) => void;
}) {
  const whenDate = formatDateTimeInTimeZone(visit.startsAt, visit.tenantTimezone, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const whenTime = `${formatVisitTime(visit.startsAt, visit.tenantTimezone)} – ${formatVisitTime(visit.endsAt, visit.tenantTimezone)}`;
  const mapsQuery = visit.mapsAddress.trim()
    ? googleMapsDirectionsUrl(visit.mapsAddress)
    : visit.siteLine.trim()
      ? googleMapsDirectionsUrl(visit.siteLine)
      : null;
  const phoneHref = visit.customerPhone
    ? `tel:${visit.customerPhone.replace(/[^\d+]/g, '')}`
    : null;
  const notes = [
    visit.notes?.trim() ? { label: 'Job', text: visit.notes.trim() } : null,
    visit.customerFieldNotes?.trim()
      ? { label: 'Customer', text: visit.customerFieldNotes.trim() }
      : null,
    visit.siteNotes?.trim() ? { label: 'Location', text: visit.siteNotes.trim() } : null,
  ].filter((note): note is { label: string; text: string } => note != null);
  const arrivedAt = clockTime(visit.checkedInAt, visit.tenantTimezone);
  const finishedAt = clockTime(visit.completedAt, visit.tenantTimezone);
  const showAmountDue =
    Boolean(visit.checkedInAt) && visit.status !== 'cancelled' && defaultAmountCents != null;

  return (
    <div className={styles.fieldVisit}>
      <div className={styles.fieldVisitWhen}>
        <div>
          <p className={styles.fieldVisitDate}>{whenDate}</p>
          <p className={styles.fieldVisitTime}>{whenTime}</p>
        </div>
        <span
          className={styles.fieldVisitStatus}
          data-status={visit.status}
          data-checked-in={visit.checkedInAt ? 'true' : 'false'}
        >
          {statusLabel(visit)}
        </span>
      </div>

      {visit.siteLine || visit.communityName ? (
        <p className={styles.fieldVisitAddress}>
          <MapPin size={18} aria-hidden />
          <span>
            {visit.communityName ? <strong>{visit.communityName}</strong> : null}
            {visit.siteLine ? <span>{visit.siteLine}</span> : null}
          </span>
        </p>
      ) : null}

      {mapsQuery || phoneHref ? (
        <div className={styles.fieldVisitQuickActions}>
          {mapsQuery ? (
            <a
              href={mapsQuery}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.fieldVisitDirections}
            >
              <Navigation size={18} aria-hidden />
              Directions
            </a>
          ) : null}
          {phoneHref ? (
            <a href={phoneHref} className={styles.fieldVisitCall}>
              <Phone size={18} aria-hidden />
              Call
            </a>
          ) : null}
        </div>
      ) : null}

      {visit.visitPurpose === 'consultation' ? (
        <ConsultationIntakeForm
          tenantSlug={visit.tenantSlug}
          visitId={visit.visitId}
          propertyKind={visit.propertyKind}
          initial={visit.consultationIntake}
          requiredFields={visit.consultationRequiredFields}
          canEdit={visit.status !== 'cancelled'}
        />
      ) : null}

      {showAmountDue ? (
        <section className={styles.fieldVisitAmount} aria-label="Amount due">
          <h2>{visit.status === 'completed' ? 'Job amount' : 'Amount due'}</h2>
          <p>${formatCentsAsDollars(defaultAmountCents ?? 0)}</p>
        </section>
      ) : null}

      {showFieldWork ? (
        <div id="field-actions">
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
            isFieldEmployee
            hasBillableAmount={hasBillableAmount}
            isConsultation={visit.visitPurpose === 'consultation'}
            initialNotes={visit.notes ?? ''}
            onVisitPatch={onVisitPatch}
            onOurWayEnabled={visit.onOurWayEnabled}
            onOurWayAlreadySent={visit.onOurWayAlreadySent}
            compact
          />
        </div>
      ) : null}

      {arrivedAt && visit.status === 'scheduled' ? (
        <p className={styles.fieldVisitMoment}>Arrived at {arrivedAt}</p>
      ) : null}
      {finishedAt ? <p className={styles.fieldVisitMoment}>Finished at {finishedAt}</p> : null}

      {visit.accessCodesText ? (
        <section className={styles.fieldVisitCodes} aria-label="Entry codes">
          <h2>Entry codes</h2>
          <p>{visit.accessCodesText}</p>
        </section>
      ) : null}

      {notes.length > 0 ? (
        <section className={styles.fieldVisitNotes} aria-label="Notes">
          <h2>Notes</h2>
          {notes.map((note) => (
            <div key={note.label}>
              {notes.length > 1 ? <p className={styles.fieldVisitNoteLabel}>{note.label}</p> : null}
              <p className={styles.fieldVisitNoteText}>{note.text}</p>
            </div>
          ))}
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
          <VisitProofPhotos photos={visit.proofPhotos} description="Proof photos from this job." />
        </section>
      ) : null}
    </div>
  );
}
