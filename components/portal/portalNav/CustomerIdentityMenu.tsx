import { AccountMenu } from '@/components/portal/AccountMenu';
import { getCustomerShellIdentity } from '@/lib/customer/customerShell';
import type { IdentityChipModel } from '@/components/portal/types';

const FALLBACK_IDENTITY: IdentityChipModel = {
  name: 'Customer',
  subtitle: 'Account',
  initials: 'CU',
};

export async function CustomerIdentityMenu({
  userId,
  settingsHref = '/settings',
}: {
  userId: string;
  settingsHref?: string;
}) {
  const identity = (await getCustomerShellIdentity(userId)) ?? FALLBACK_IDENTITY;
  return <AccountMenu {...identity} settingsHref={settingsHref} />;
}
