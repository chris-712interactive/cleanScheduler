'use client';

import { useCallback, useState } from 'react';
import { EmptyState } from '@/components/ui/EmptyState';
import { RescheduleRequestCard } from './RescheduleRequestCard';
import type { AssigneeConflictInfo } from '@/lib/schedule/visitAssigneeConflicts';
import styles from './rescheduleRequests.module.scss';

export type PendingRescheduleRequest = {
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

export function RescheduleRequestsPendingList({
  tenantSlug,
  tenantTimezone,
  requests: initialRequests,
}: {
  tenantSlug: string;
  tenantTimezone: string;
  requests: PendingRescheduleRequest[];
}) {
  const [requests, setRequests] = useState(initialRequests);

  const onRequestResolved = useCallback((requestId: string) => {
    setRequests((current) => current.filter((r) => r.requestId !== requestId));
  }, []);

  if (requests.length === 0) {
    return (
      <EmptyState
        title="No open requests"
        description="When a customer asks to reschedule, their request will appear here."
      />
    );
  }

  return (
    <ul className={styles.list}>
      {requests.map((r) => (
        <li key={r.requestId}>
          <RescheduleRequestCard
            tenantSlug={tenantSlug}
            requestId={r.requestId}
            visitId={r.visitId}
            customerName={r.customerName}
            phone={r.phone}
            email={r.email}
            originalStartsAt={r.originalStartsAt}
            originalEndsAt={r.originalEndsAt}
            preferredStartsAt={r.preferredStartsAt}
            preferredEndsAt={r.preferredEndsAt}
            applyWhenLabel={r.applyWhenLabel}
            canApplyTime={r.canApplyTime}
            conflicts={r.conflicts}
            tenantTimezone={tenantTimezone}
            onRequestResolved={onRequestResolved}
          />
        </li>
      ))}
    </ul>
  );
}
