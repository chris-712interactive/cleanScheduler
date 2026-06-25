import Link from 'next/link';
import { SMS_OPT_IN_CHECKBOX_DISCLOSURE } from '@/lib/legal/smsOptIn';

/** Checkbox label copy with required Privacy Policy and SMS Terms links for 10DLC review. */
export function SmsOptInCheckboxLabel() {
  return (
    <span>
      {SMS_OPT_IN_CHECKBOX_DISCLOSURE} View our <Link href="/privacy">Privacy Policy</Link> and{' '}
      <Link href="/sms-terms">Terms &amp; Conditions</Link>.
    </span>
  );
}
