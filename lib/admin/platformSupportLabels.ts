export const PLATFORM_SUPPORT_STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  waiting_on_tenant: 'Waiting on tenant',
  waiting_on_platform: 'Waiting on platform',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const PLATFORM_SUPPORT_CATEGORY_LABEL: Record<string, string> = {
  billing: 'Billing',
  technical: 'Technical',
  account: 'Account',
  other: 'Other',
};

export type PlatformSupportInboxFilter = 'open' | 'closed' | 'all';

export function isPlatformSupportTicketOpen(status: string): boolean {
  return status !== 'resolved' && status !== 'closed';
}
