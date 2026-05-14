import { createAdminClient } from '@/lib/supabase/server';
import type { IdentityChipModel } from '@/components/portal/types';
import { formatCustomerDisplayName } from '@/lib/tenant/customerIdentityName';

function initialsFromName(name: string | null | undefined, email: string | null | undefined): string {
  const n = (name ?? '').trim();
  if (n.length >= 2) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  }
  const e = (email ?? '').trim();
  if (e.length >= 2) return e.slice(0, 2).toUpperCase();
  return 'CU';
}

export async function getCustomerShellIdentity(userId: string): Promise<IdentityChipModel | null> {
  const admin = createAdminClient();
  const { data: identity } = await admin
    .from('customer_identities')
    .select('first_name, last_name, full_name, email')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (!identity) return null;

  const formatted = formatCustomerDisplayName(identity);
  const display = formatted !== 'Unnamed' ? formatted : identity.email?.trim() || 'Customer';
  return {
    name: display,
    subtitle: 'Customer account',
    initials: initialsFromName(display, identity.email),
  };
}
