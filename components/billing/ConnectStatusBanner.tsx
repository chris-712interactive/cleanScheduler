import type { Enums } from '@/lib/supabase/database.types';
import { RegisterAccountNotice } from '@/components/portal/accountNotices/RegisterAccountNotice';
import { buildConnectAccountNotice } from '@/lib/billing/accountNotices';

export type TenantStripeConnectStatus = Enums<'tenant_stripe_connect_status'>;

/** Publishes a card-payment setup reminder into the header notice chip. */
export function ConnectStatusBanner({ status }: { status: TenantStripeConnectStatus }) {
  const notice = buildConnectAccountNotice(status);
  if (!notice) return null;
  return <RegisterAccountNotice notice={notice} />;
}
