import { RegisterAccountNotice } from '@/components/portal/accountNotices/RegisterAccountNotice';
import { buildUsageAccountNotice } from '@/lib/billing/accountNotices';
import type { UtilizationAlert } from '@/lib/billing/usageUtilization';

/** Publishes a plan-limit reminder into the header notice chip. */
export function UsageUtilizationBanner({ alert }: { alert: UtilizationAlert }) {
  return <RegisterAccountNotice notice={buildUsageAccountNotice(alert)} />;
}
