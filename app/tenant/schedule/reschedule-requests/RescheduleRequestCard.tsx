import { ArrowRight, Calendar, Clock, Mail, Phone } from 'lucide-react';
import {
  formatContactPhone,
  formatCustomerInitials,
  formatRescheduleCardDate,
  formatRescheduleCardTimeRange,
} from '@/lib/schedule/rescheduleRequestCardDisplay';
import type { AssigneeConflictInfo } from '@/lib/schedule/visitAssigneeConflicts';
import { TenantRescheduleDecisionRow } from './TenantRescheduleDecisionRow';
import styles from './rescheduleRequests.module.scss';

export type RescheduleRequestCardProps = {
  tenantSlug: string;
  requestId: string;
  visitId: string | null;
  customerName: string;
  phone: string | null;
  email: string | null;
  originalStartsAt: string | null;
  originalEndsAt: string | null;
  preferredStartsAt: string | null;
  preferredEndsAt: string | null;
  applyWhenLabel: string | null;
  canApplyTime: boolean;
  conflicts: AssigneeConflictInfo[];
};

export function RescheduleRequestCard({
  tenantSlug,
  requestId,
  visitId,
  customerName,
  phone,
  email,
  originalStartsAt,
  originalEndsAt,
  preferredStartsAt,
  preferredEndsAt,
  applyWhenLabel,
  canApplyTime,
  conflicts,
  tenantTimezone,
}: RescheduleRequestCardProps & { tenantTimezone: string }) {
  const initials = formatCustomerInitials(customerName);
  const phoneLabel = formatContactPhone(phone);
  const emailLabel = email?.trim() || null;

  const originalDate = formatRescheduleCardDate(originalStartsAt, tenantTimezone);
  const originalTime = formatRescheduleCardTimeRange(
    originalStartsAt,
    originalEndsAt,
    tenantTimezone,
  );
  const requestedDate = formatRescheduleCardDate(preferredStartsAt, tenantTimezone);
  const requestedTime = formatRescheduleCardTimeRange(
    preferredStartsAt,
    preferredEndsAt,
    tenantTimezone,
  );

  return (
    <article className={styles.card}>
      <div className={styles.cardAccent} aria-hidden />
      <div className={styles.cardInner}>
        <div className={styles.customerBlock}>
          <span className={styles.avatar} aria-hidden>
            {initials}
          </span>
          <div className={styles.customerCopy}>
            <p className={styles.customerName} title={customerName}>
              {customerName}
            </p>
            {phoneLabel ? (
              <p className={styles.contactLine}>
                <Phone size={14} className={styles.contactIcon} aria-hidden />
                <span className={styles.contactText} title={phoneLabel}>
                  {phoneLabel}
                </span>
              </p>
            ) : null}
            {emailLabel ? (
              <p className={styles.contactLine}>
                <Mail size={14} className={styles.contactIcon} aria-hidden />
                <span className={styles.contactText} title={emailLabel}>
                  {emailLabel}
                </span>
              </p>
            ) : null}
          </div>
        </div>

        <div className={styles.scheduleBlock}>
          <div className={styles.scheduleColumn}>
            <p className={styles.scheduleLabel}>Originally scheduled</p>
            {originalDate ? (
              <p className={styles.scheduleLine}>
                <Calendar size={14} className={styles.scheduleIcon} aria-hidden />
                <span>{originalDate}</span>
              </p>
            ) : null}
            {originalTime ? (
              <p className={styles.scheduleLine}>
                <Clock size={14} className={styles.scheduleIcon} aria-hidden />
                <span>{originalTime}</span>
              </p>
            ) : (
              <p className={styles.scheduleMissing}>—</p>
            )}
          </div>

          <ArrowRight size={18} className={styles.scheduleArrow} aria-hidden />

          <div className={styles.scheduleColumn} data-variant="requested">
            <p className={styles.scheduleLabel}>Requested time</p>
            {requestedDate ? (
              <p className={styles.scheduleLine}>
                <Calendar size={14} className={styles.scheduleIcon} aria-hidden />
                <span>{requestedDate}</span>
              </p>
            ) : (
              <p className={styles.scheduleMissing}>No date requested</p>
            )}
            {requestedTime ? (
              <p className={styles.scheduleLine}>
                <Clock size={14} className={styles.scheduleIcon} aria-hidden />
                <span>{requestedTime}</span>
              </p>
            ) : null}
          </div>
        </div>

        <TenantRescheduleDecisionRow
          tenantSlug={tenantSlug}
          requestId={requestId}
          visitId={visitId}
          applyWhenLabel={applyWhenLabel}
          canApplyTime={canApplyTime}
          initialConflicts={conflicts}
        />
      </div>
    </article>
  );
}
