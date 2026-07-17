'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import {
  buildScheduleConsultationPath,
  type ConsultationStatus,
} from '@/lib/tenant/customerConsultation';
import styles from './quotes.module.scss';

export type QuoteConsultationPromptInfo = {
  status: Extract<ConsultationStatus, 'needs_scheduling' | 'scheduled'>;
  nextConsultationId: string | null;
};

/**
 * Inline prompt on quote create/edit so admins can book or open a consultation
 * without leaving the quote flow mentally.
 */
export function QuoteConsultationPrompt({
  customerId,
  propertyId,
  prompt,
  returnTo,
  schedulePathOverride,
  errorMessage,
}: {
  customerId: string;
  propertyId?: string | null;
  prompt?: QuoteConsultationPromptInfo | null;
  returnTo?: string | null;
  /** From server action when send is blocked — preferred over prompt-derived path. */
  schedulePathOverride?: string | null;
  errorMessage?: string | null;
}) {
  const derivedPath =
    prompt?.status === 'scheduled' && prompt.nextConsultationId
      ? `/schedule/${prompt.nextConsultationId}`
      : customerId
        ? buildScheduleConsultationPath(customerId, propertyId, { returnTo })
        : null;

  const href = schedulePathOverride?.trim() || derivedPath;
  if (!href && !errorMessage && !prompt) return null;

  const needsScheduling =
    Boolean(schedulePathOverride) ||
    prompt?.status === 'needs_scheduling' ||
    (errorMessage?.toLowerCase().includes('consultation') ?? false);

  const isOpenVisit = href?.startsWith('/schedule/') && !href.includes('/schedule/new');

  const title = isOpenVisit
    ? 'Consultation scheduled'
    : needsScheduling
      ? 'Consultation required before sending'
      : 'Consultation';

  const detail =
    errorMessage?.trim() ||
    (isOpenVisit
      ? 'Mark the consultation complete after the walkthrough, then send this quote.'
      : 'Schedule a house visit for this customer, then come back and send the quote.');

  const ctaLabel = isOpenVisit ? 'Open consultation' : 'Schedule consultation';

  return (
    <div className={styles.consultationPrompt} role="status">
      <div className={styles.consultationPromptCopy}>
        <strong>{title}</strong>
        <p>{detail}</p>
      </div>
      {href ? (
        <Button as={Link} href={href} variant="primary">
          {ctaLabel}
        </Button>
      ) : null}
    </div>
  );
}
