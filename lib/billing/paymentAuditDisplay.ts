import type { StatusTone } from '@/components/ui/StatusPill';
import type { ManualPaymentAuditStage } from '@/lib/billing/manualPaymentAudit';

export function formatPaymentAuditPosted(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function paymentAuditStageLabel(stage: ManualPaymentAuditStage): string {
  switch (stage) {
    case 'awaiting_receipt':
      return 'Awaiting receipt';
    case 'awaiting_deposit':
      return 'Awaiting deposit';
    case 'awaiting_clearance':
      return 'Awaiting clearance';
    case 'bounced':
      return 'Bounced';
    case 'complete':
      return 'Complete';
  }
}

export function paymentAuditStageTone(stage: ManualPaymentAuditStage): StatusTone {
  switch (stage) {
    case 'awaiting_receipt':
      return 'warning';
    case 'awaiting_deposit':
      return 'info';
    case 'awaiting_clearance':
      return 'info';
    case 'bounced':
      return 'danger';
    case 'complete':
      return 'success';
  }
}
