import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

const MAX_AUTHOR_NAME_LENGTH = 120;

export function formatSupportAuthorName(
  profile:
    | {
        display_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      }
    | null
    | undefined,
): string | null {
  const displayName = profile?.display_name?.trim();
  const givenName = [profile?.first_name, profile?.last_name]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(' ');
  const name = displayName || givenName;
  if (!name) return null;
  return name.slice(0, MAX_AUTHOR_NAME_LENGTH);
}

export async function loadSupportAuthorDisplayName(
  db: SupabaseClient<Database>,
  userId: string,
): Promise<string | null> {
  const { data } = await db
    .from('user_profiles')
    .select('display_name, first_name, last_name')
    .eq('user_id', userId)
    .maybeSingle();
  return formatSupportAuthorName(data);
}

export function supportMessageSenderLabel(input: {
  isFromCustomer: boolean;
  authorDisplayName: string | null;
  authorUserId?: string | null;
  customerSide: boolean;
  currentUserId?: string | null;
  customerName: string;
  tenantName: string;
}): string {
  const saved = input.authorDisplayName?.trim() || null;
  if (input.customerSide && input.isFromCustomer) {
    const someoneElse =
      Boolean(input.currentUserId) &&
      Boolean(input.authorUserId) &&
      input.currentUserId !== input.authorUserId;
    if (someoneElse) return saved || 'Customer';
    return 'You';
  }
  if (input.isFromCustomer) return saved || input.customerName;
  if (input.customerSide) return saved || input.tenantName;
  return saved || 'Team member';
}
